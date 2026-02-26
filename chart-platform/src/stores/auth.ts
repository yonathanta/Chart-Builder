import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const AUTH_TOKEN_KEY = 'token'

export interface AuthUser {
  email: string
}

export interface LoginPayload {
  token: string
  user?: AuthUser | null
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => Boolean(token.value))

  function login(payload: LoginPayload): void {
    token.value = payload.token
    user.value = payload.user ?? null
    localStorage.setItem(AUTH_TOKEN_KEY, payload.token)
  }

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem(AUTH_TOKEN_KEY)
  }

  function checkAuth(): void {
    const storedToken = localStorage.getItem(AUTH_TOKEN_KEY)
    token.value = storedToken
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    checkAuth,
  }
})