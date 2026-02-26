import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface AuthUser {
    email: string
}

interface AuthSession {
    token: string
    user: AuthUser
}

const AUTH_STORAGE_KEY = 'authSession'

export const useAuthStore = defineStore('auth', () => {
    const session = ref<AuthSession | null>(null)

    const savedSession = localStorage.getItem(AUTH_STORAGE_KEY)
    if (savedSession) {
        try {
            session.value = JSON.parse(savedSession) as AuthSession
        } catch {
            localStorage.removeItem(AUTH_STORAGE_KEY)
        }
    }

    const isAuthenticated = computed(() => !!session.value?.token)
    const userEmail = computed(() => session.value?.user.email ?? '')

    const login = (payload: AuthSession) => {
        session.value = payload
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
    }

    const logout = () => {
        session.value = null
        localStorage.removeItem(AUTH_STORAGE_KEY)
    }

    return {
        session,
        isAuthenticated,
        userEmail,
        login,
        logout
    }
})
