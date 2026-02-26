import { createRouter, createWebHashHistory } from 'vue-router'
import ChartBuilderPage from '../pages/ChartBuilderPage.vue'
import DashboardBuilderPage from '../pages/DashboardBuilderPage.vue'
import ReportBuilderPage from '../pages/ReportBuilderPage.vue'
import LoginPage from '../pages/LoginPage.vue'
import { useAuthStore } from '../stores/auth'

const routes = [
    {
        path: '/login',
        name: 'login',
        component: LoginPage,
        meta: {
            requiresAuth: false,
            hideNav: true
        }
    },
    {
        path: '/',
        name: 'chart-builder',
        component: ChartBuilderPage,
        meta: { requiresAuth: true }
    },
    {
        path: '/dashboard',
        name: 'dashboard-builder',
        component: DashboardBuilderPage,
        meta: { requiresAuth: true }
    },
    {
        path: '/report',
        name: 'report-builder',
        component: ReportBuilderPage,
        meta: { requiresAuth: true }
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()
    const isAuthenticated = authStore.isAuthenticated

    if (to.path === '/login' && isAuthenticated) {
        next('/')
        return
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
        return
    }

    next()
})

export default router
