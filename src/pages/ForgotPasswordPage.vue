<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import authService from '../services/authService';

const router = useRouter();

const form = reactive({
  email: '',
});

const formError = ref('');
const submitMessage = ref('');
const resetLink = ref<string | null>(null);
const isLoading = ref(false);

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validate(): boolean {
  if (!form.email.trim()) {
    formError.value = 'Email is required.';
    return false;
  }

  if (!isValidEmail(form.email.trim())) {
    formError.value = 'Enter a valid email address.';
    return false;
  }

  formError.value = '';
  return true;
}

function getErrorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const maybe = error as {
      message?: string;
      response?: { data?: { error?: string; message?: string; details?: string | string[] } | string };
    };

    const responseData = maybe.response?.data;
    if (typeof responseData === 'string' && responseData.trim().length > 0) {
      return responseData;
    }

    if (typeof responseData === 'object' && responseData !== null) {
      if (typeof responseData.details === 'string' && responseData.details.trim().length > 0) {
        return responseData.details;
      }

      if (Array.isArray(responseData.details) && responseData.details.length > 0) {
        return responseData.details[0] ?? 'Unable to process request.';
      }

      if (typeof responseData.error === 'string' && responseData.error.trim().length > 0) {
        return responseData.error;
      }

      if (typeof responseData.message === 'string' && responseData.message.trim().length > 0) {
        return responseData.message;
      }
    }

    if (typeof maybe.message === 'string' && maybe.message.trim().length > 0) {
      return maybe.message;
    }
  }

  return 'Unable to process forgot password request right now.';
}

async function handleSubmit(): Promise<void> {
  formError.value = '';
  submitMessage.value = '';
  resetLink.value = null;

  if (!validate()) {
    return;
  }

  isLoading.value = true;
  try {
    const response = await authService.forgotPassword(form.email.trim());
    submitMessage.value = response.message ?? 'If the email exists, a reset link has been generated.';
    resetLink.value = response.resetLink ?? null;
  } catch (error) {
    formError.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}

function goToLogin(): void {
  router.push('/login');
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <h1>Forgot Password</h1>
      <p>Enter your email and we will generate a reset link.</p>

      <form class="auth-form" @submit.prevent="handleSubmit" novalidate>
        <label class="field-group">
          <span>Email</span>
          <input v-model="form.email" type="email" autocomplete="email" placeholder="you@example.com" />
        </label>

        <p v-if="formError" class="error-text">{{ formError }}</p>
        <p v-if="submitMessage" class="success-text">{{ submitMessage }}</p>

        <div v-if="resetLink" class="reset-link-box">
          <p>Reset link (development mode):</p>
          <a :href="resetLink">{{ resetLink }}</a>
        </div>

        <button type="submit" class="primary-btn" :disabled="isLoading">
          {{ isLoading ? 'Generating...' : 'Generate Reset Link' }}
        </button>
      </form>

      <button type="button" class="secondary-link" @click="goToLogin">Back to login</button>
    </section>
  </main>
</template>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
  background: #0b0f14;
}

.auth-card {
  width: min(100%, 540px);
  background: #ffffff;
  border-radius: 16px;
  padding: 28px;
}

.auth-form {
  display: grid;
  gap: 14px;
  margin-top: 16px;
}

.field-group {
  display: grid;
  gap: 6px;
}

.field-group input {
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  padding: 10px 12px;
}

.primary-btn {
  border: 1px solid #0ea5e9;
  background: #0ea5e9;
  color: white;
  border-radius: 10px;
  padding: 11px 14px;
  font-weight: 600;
}

.primary-btn:disabled {
  opacity: 0.7;
}

.secondary-link {
  margin-top: 16px;
  border: none;
  background: transparent;
  color: #0369a1;
  cursor: pointer;
}

.error-text {
  color: #dc2626;
}

.success-text {
  color: #047857;
}

.reset-link-box {
  padding: 10px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  overflow-wrap: anywhere;
}
</style>
