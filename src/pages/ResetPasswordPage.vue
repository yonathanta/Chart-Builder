<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import authService from '../services/authService';

const route = useRoute();
const router = useRouter();

const token = ref<string>(typeof route.query.token === 'string' ? route.query.token : '');

const form = reactive({
  newPassword: '',
  confirmPassword: '',
});

const formError = ref('');
const successMessage = ref('');
const isLoading = ref(false);

function validatePassword(password: string): string | null {
  if (password.length < 8) return 'Password must be at least 8 characters.';
  if (!/[A-Z]/.test(password)) return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password)) return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password)) return 'Password must include at least one number.';
  return null;
}

function validate(): boolean {
  if (!token.value.trim()) {
    formError.value = 'Reset token is missing.';
    return false;
  }

  const passwordError = validatePassword(form.newPassword);
  if (passwordError) {
    formError.value = passwordError;
    return false;
  }

  if (form.newPassword !== form.confirmPassword) {
    formError.value = 'Passwords do not match.';
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
        return responseData.details[0] ?? 'Unable to reset password.';
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

  return 'Unable to reset password right now.';
}

async function handleSubmit(): Promise<void> {
  formError.value = '';
  successMessage.value = '';

  if (!validate()) {
    return;
  }

  isLoading.value = true;
  try {
    await authService.resetPassword(token.value.trim(), form.newPassword);
    successMessage.value = 'Password reset successful. Redirecting to login...';
    setTimeout(() => {
      router.push('/login');
    }, 900);
  } catch (error) {
    formError.value = getErrorMessage(error);
  } finally {
    isLoading.value = false;
  }
}
</script>

<template>
  <main class="auth-page">
    <section class="auth-card">
      <h1>Reset Password</h1>
      <p>Enter your new password.</p>

      <form class="auth-form" @submit.prevent="handleSubmit" novalidate>
        <label class="field-group">
          <span>New Password</span>
          <input v-model="form.newPassword" type="password" autocomplete="new-password" />
        </label>

        <label class="field-group">
          <span>Confirm Password</span>
          <input v-model="form.confirmPassword" type="password" autocomplete="new-password" />
        </label>

        <p v-if="formError" class="error-text">{{ formError }}</p>
        <p v-if="successMessage" class="success-text">{{ successMessage }}</p>

        <button type="submit" class="primary-btn" :disabled="isLoading">
          {{ isLoading ? 'Resetting...' : 'Reset Password' }}
        </button>
      </form>
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

.error-text {
  color: #dc2626;
}

.success-text {
  color: #047857;
}
</style>
