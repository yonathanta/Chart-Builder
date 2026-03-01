<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import authService from '../services/authService'

const router = useRouter()

const form = reactive({
  email: '',
  password: '',
})

const formError = ref('')
const isLoading = ref(false)

function validateFields(): boolean {
  if (!form.email.trim() || !form.password.trim()) {
    formError.value = 'Email and password are required.'
    return false
  }

  formError.value = ''
  return true
}

function getErrorMessage(error: unknown): string {
  const fallbackMessage = 'Unable to sign in right now. Please try again.'

  if (typeof error === 'object' && error !== null) {
    const maybeResponse = (error as { response?: { data?: { error?: string; message?: string } } }).response
    const apiMessage = maybeResponse?.data?.error ?? maybeResponse?.data?.message

    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage
    }
  }

  return fallbackMessage
}

async function handleLogin(): Promise<void> {
  if (!validateFields()) {
    return
  }

  isLoading.value = true
  formError.value = ''

  try {
    await authService.login(form.email.trim(), form.password)
    await router.push('/dashboard')
  } catch (error) {
    formError.value = getErrorMessage(error)
  } finally {
    isLoading.value = false
  }
}

function handleDevelopmentSkip(): void {
  router.push('/dashboard')
}
</script>

<template>
  <main class="login-page">
    <section class="login-shell">
      <aside class="brand-panel">
        <div class="brand-mark">
          <svg viewBox="0 0 48 48" aria-hidden="true">
            <path
              d="M8 36V14m10 22V10m10 26V20m10 16V8"
              fill="none"
              stroke="currentColor"
              stroke-width="3"
              stroke-linecap="round"
            />
          </svg>
          <div>
            <p class="brand-name">ECAStats Chartbuilder</p>
            <p class="brand-sub">Powerful dashboards, stunning charts, and insightful reports.</p>
          </div>
        </div>
        <div class="brand-copy">
          Create data stories with clarity and confidence.
        </div>
      </aside>

      <section class="auth-panel">
        <div class="auth-card">
          <header class="auth-header">
            <h1>Welcome back</h1>
            <p>Sign in to your account to continue</p>
          </header>

          <form class="login-form" @submit.prevent="handleLogin">
            <label class="field-group">
              <span>Email</span>
              <input v-model="form.email" type="email" autocomplete="email" placeholder="you@company.com" />
            </label>

            <label class="field-group">
              <span>Password</span>
              <div class="password-field">
                <input
                  v-model="form.password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                />
                <span class="eye-icon" aria-hidden="true">◦</span>
              </div>
            </label>

            <div class="form-row">
              <label class="checkbox-field">
                <input type="checkbox" />
                <span>Remember me</span>
              </label>
              <button type="button" class="link-button">Forgot password?</button>
            </div>

            <p v-if="formError" class="error-text">{{ formError }}</p>

            <button type="submit" class="login-button" :disabled="isLoading">
              {{ isLoading ? 'Signing In...' : 'Sign In' }}
            </button>
          </form>

          <p class="signup-text">
            Don't have an account? <button type="button" class="link-button">Create one</button>
          </p>
          <button type="button" class="skip-link" @click="handleDevelopmentSkip">
            Skip for now (Development Mode)
          </button>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: stretch;
  justify-content: center;
  padding: 0;
  font-family: "Space Grotesk", "IBM Plex Sans", "Segoe UI", sans-serif;
  background: #0b0f14;
}

.login-shell {
  width: 100%;
  max-width: 1100px;
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(320px, 1fr) minmax(420px, 1fr);
}

.brand-panel {
  position: relative;
  color: #0f172a;
  background: linear-gradient(135deg, #18c5c8 0%, #10b6d6 55%, #0ea5e9 100%);
  padding: 72px 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.brand-panel::before,
.brand-panel::after {
  content: "";
  position: absolute;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  z-index: 0;
}

.brand-panel::before {
  width: 220px;
  height: 220px;
  right: -60px;
  top: 40px;
}

.brand-panel::after {
  width: 320px;
  height: 320px;
  left: -140px;
  bottom: -120px;
}

.brand-mark {
  display: flex;
  gap: 16px;
  align-items: center;
  justify-content: center;
  position: relative;
  z-index: 1;
  text-align: left;
}

.brand-mark svg {
  width: 44px;
  height: 44px;
  color: #0f172a;
}

.brand-name {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.brand-sub {
  margin: 4px 0 0;
  font-size: 14px;
  max-width: 280px;
  text-align: left;
}

.brand-copy {
  position: relative;
  z-index: 1;
  font-size: 15px;
  max-width: 280px;
  text-align: left;
  margin-top: 18px;
}

.auth-panel {
  background: radial-gradient(circle at top right, #1a2230 0%, #0b0f14 55%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 24px;
}

.auth-card {
  width: 100%;
  max-width: 420px;
  background: #0f131a;
  border: 1px solid #1f2937;
  border-radius: 16px;
  padding: 32px;
  color: #e5e7eb;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
}

.auth-header h1 {
  margin: 0;
  font-size: 24px;
}

.auth-header p {
  margin: 6px 0 0;
  color: #9ca3af;
  font-size: 14px;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 24px;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #cbd5f5;
}

.field-group input {
  height: 40px;
  border: 1px solid #1f2937;
  border-radius: 8px;
  padding: 0 12px;
  background: #0b1018;
  color: #e5e7eb;
}

.field-group input::placeholder {
  color: #4b5563;
}

.password-field {
  position: relative;
  display: flex;
  align-items: center;
}

.password-field input {
  width: 100%;
}

.eye-icon {
  position: absolute;
  right: 12px;
  font-size: 16px;
  color: #4b5563;
}

.form-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  color: #9ca3af;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-button {
  border: none;
  background: transparent;
  color: #22d3ee;
  cursor: pointer;
  padding: 0;
  font-size: 12px;
}

.error-text {
  margin: 0;
  color: #f87171;
}

.login-button {
  height: 42px;
  border: none;
  border-radius: 10px;
  background: linear-gradient(90deg, #14b8a6, #22d3ee);
  color: #0f172a;
  font-weight: 700;
  cursor: pointer;
}

.login-button:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.signup-text {
  margin: 18px 0 8px;
  font-size: 12px;
  color: #9ca3af;
}

.skip-link {
  border: none;
  background: transparent;
  color: #9ca3af;
  text-decoration: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
}

@media (max-width: 900px) {
  .login-shell {
    grid-template-columns: 1fr;
  }

  .brand-panel {
    min-height: 240px;
    padding: 48px 32px;
  }
}
</style>
