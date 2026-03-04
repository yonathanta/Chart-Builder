<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../services/api'

const router = useRouter()

const form = reactive({
  firstName: '',
  lastName: '',
  email: '',
  phoneNumber: '',
  department: '',
  jobTitle: '',
  password: '',
  confirmPassword: '',
})

const errors = reactive<Record<string, string>>({})
const isLoading = ref(false)
const successMessage = ref('')
const submitError = ref('')

function clearErrors(): void {
  Object.keys(errors).forEach((key) => {
    delete errors[key]
  })
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateForm(): boolean {
  clearErrors()

  if (!form.firstName.trim()) errors.firstName = 'First name is required.'
  if (!form.lastName.trim()) errors.lastName = 'Last name is required.'

  if (!form.email.trim()) {
    errors.email = 'Email is required.'
  } else if (!isValidEmail(form.email.trim())) {
    errors.email = 'Enter a valid email address.'
  }

  if (!form.phoneNumber.trim()) errors.phoneNumber = 'Phone number is required.'
  if (!form.department.trim()) errors.department = 'Department is required.'
  if (!form.jobTitle.trim()) errors.jobTitle = 'Job title is required.'

  if (!form.password) {
    errors.password = 'Password is required.'
  } else if (form.password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  }

  if (!form.confirmPassword) {
    errors.confirmPassword = 'Please confirm your password.'
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match.'
  }

  return Object.keys(errors).length === 0
}

function toFormKey(rawKey: string): string {
  const key = rawKey.includes('.') ? rawKey.split('.').pop() ?? rawKey : rawKey
  if (!key) {
    return rawKey
  }

  return key.charAt(0).toLowerCase() + key.slice(1)
}

function applyServerErrors(error: unknown): string {
  const fallback = 'Unable to submit registration at this time.'

  if (typeof error !== 'object' || error === null) {
    return fallback
  }

  const maybeResponse = error as {
    response?: {
      data?: {
        error?: string
        message?: string
        title?: string
        details?: string[]
        errors?: Record<string, string[]>
      }
    }
  }

  const data = maybeResponse.response?.data
  if (!data) {
    return fallback
  }

  if (data.errors && typeof data.errors === 'object') {
    const fieldEntries = Object.entries(data.errors)
    for (const [rawKey, messages] of fieldEntries) {
      if (!Array.isArray(messages) || messages.length === 0) {
        continue
      }

      const formKey = toFormKey(rawKey)
      errors[formKey] = messages[0]
    }

    if (fieldEntries.length > 0) {
      return data.title ?? 'Please correct the highlighted fields.'
    }
  }

  if (Array.isArray(data.details) && data.details.length > 0) {
    return data.details[0]
  }

  const apiMessage = data.error ?? data.message ?? data.title
  if (typeof apiMessage === 'string' && apiMessage.trim()) {
    return apiMessage
  }

  return fallback
}

function resetMessages(): void {
  successMessage.value = ''
  submitError.value = ''
  clearErrors()
}

async function handleSubmit(): Promise<void> {
  resetMessages()

  if (!validateForm()) {
    return
  }

  isLoading.value = true
  try {
    await api.post('/account/register', {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      email: form.email.trim(),
      phoneNumber: form.phoneNumber.trim(),
      department: form.department.trim(),
      jobTitle: form.jobTitle.trim(),
      password: form.password,
      confirmPassword: form.confirmPassword,
    })

    successMessage.value = 'Registration submitted. Awaiting admin approval.'
  } catch (error) {
    submitError.value = applyServerErrors(error)
  } finally {
    isLoading.value = false
  }
}

function goToLogin(): void {
  router.push('/login')
}
</script>

<template>
  <main class="register-page">
    <section class="register-card">
      <header class="register-header">
        <h1>Institutional Registration</h1>
        <p>Complete the form below to request account access.</p>
      </header>

      <form class="register-form" novalidate @submit.prevent="handleSubmit">
        <div class="name-grid">
          <label class="field">
            <span>First Name</span>
            <input v-model="form.firstName" type="text" autocomplete="given-name" />
            <small v-if="errors.firstName" class="error">{{ errors.firstName }}</small>
          </label>

          <label class="field">
            <span>Last Name</span>
            <input v-model="form.lastName" type="text" autocomplete="family-name" />
            <small v-if="errors.lastName" class="error">{{ errors.lastName }}</small>
          </label>
        </div>

        <label class="field">
          <span>Email</span>
          <input v-model="form.email" type="email" autocomplete="email" />
          <small v-if="errors.email" class="error">{{ errors.email }}</small>
        </label>

        <label class="field">
          <span>Phone Number</span>
          <input v-model="form.phoneNumber" type="tel" autocomplete="tel" />
          <small v-if="errors.phoneNumber" class="error">{{ errors.phoneNumber }}</small>
        </label>

        <label class="field">
          <span>Department</span>
          <input v-model="form.department" type="text" />
          <small v-if="errors.department" class="error">{{ errors.department }}</small>
        </label>

        <label class="field">
          <span>Job Title</span>
          <input v-model="form.jobTitle" type="text" />
          <small v-if="errors.jobTitle" class="error">{{ errors.jobTitle }}</small>
        </label>

        <label class="field">
          <span>Password</span>
          <input v-model="form.password" type="password" autocomplete="new-password" />
          <small v-if="errors.password" class="error">{{ errors.password }}</small>
        </label>

        <label class="field">
          <span>Confirm Password</span>
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" />
          <small v-if="errors.confirmPassword" class="error">{{ errors.confirmPassword }}</small>
        </label>

        <p v-if="submitError" class="submit-error">{{ submitError }}</p>
        <p v-if="successMessage" class="success">{{ successMessage }}</p>

        <button class="submit-btn" type="submit" :disabled="isLoading">
          {{ isLoading ? 'Submitting...' : 'Submit Registration' }}
        </button>
      </form>

      <button type="button" class="secondary-link" @click="goToLogin">Back to login</button>
    </section>
  </main>
</template>

<style scoped>
.register-page {
  min-height: 100vh;
  background: #f4f7fb;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
}

.register-card {
  width: 100%;
  max-width: 760px;
  background: #ffffff;
  border: 1px solid #dbe6f4;
  border-radius: 12px;
  padding: 28px;
  box-shadow: 0 12px 30px rgba(9, 63, 127, 0.08);
}

.register-header h1 {
  margin: 0;
  color: #003f7f;
  font-size: 1.5rem;
}

.register-header p {
  margin: 8px 0 0;
  color: #4b5d73;
}

.register-form {
  margin-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.name-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  color: #24364b;
  font-size: 0.9rem;
}

.field input {
  height: 40px;
  border: 1px solid #c8d7ea;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 0.95rem;
}

.field input:focus {
  outline: none;
  border-color: #009edb;
  box-shadow: 0 0 0 3px rgba(0, 158, 219, 0.15);
}

.error,
.submit-error {
  color: #b42318;
  font-size: 0.8rem;
}

.success {
  color: #0f766e;
  font-size: 0.9rem;
}

.submit-btn {
  height: 42px;
  border: none;
  border-radius: 8px;
  background: #009edb;
  color: #ffffff;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.secondary-link {
  margin-top: 12px;
  border: none;
  background: transparent;
  color: #003f7f;
  font-weight: 600;
  cursor: pointer;
}

@media (max-width: 640px) {
  .name-grid {
    grid-template-columns: 1fr;
  }

  .register-card {
    padding: 22px;
  }
}
</style>
