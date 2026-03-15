import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

interface AuthUser {
    id?: string
    email: string
    role?: string
}

interface AuthSession {
    token: string
    user: AuthUser
}

const AUTH_STORAGE_KEY = 'authSession'
const TOKEN_STORAGE_KEY = 'token'
const USER_STORAGE_KEY = 'user'

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

    if (!session.value) {
        const savedToken = localStorage.getItem(TOKEN_STORAGE_KEY)
        const savedUser = localStorage.getItem(USER_STORAGE_KEY)

        if (savedToken && savedUser) {
            try {
                const parsedUser = JSON.parse(savedUser) as AuthUser
                session.value = {
                    token: savedToken,
                    user: {
                        id: parsedUser.id,
                        email: parsedUser.email ?? '',
                        role: parsedUser.role
                    }
                }
                localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session.value))
            } catch {
                localStorage.removeItem(USER_STORAGE_KEY)
            }
        }
    }

    const isAuthenticated = computed(() => !!session.value?.token)
    const userEmail = computed(() => session.value?.user.email ?? '')
    const userRole = computed(() => session.value?.user.role ?? '')

    const login = (payload: AuthSession) => {
        session.value = payload
        localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(payload))
        localStorage.setItem(TOKEN_STORAGE_KEY, payload.token)
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(payload.user))
    }

    const logout = () => {
        session.value = null
        localStorage.removeItem(AUTH_STORAGE_KEY)
        localStorage.removeItem(TOKEN_STORAGE_KEY)
        localStorage.removeItem(USER_STORAGE_KEY)
    }

    return {
        session,
        isAuthenticated,
        userEmail,
        userRole,
        login,
        logout
    }
})
