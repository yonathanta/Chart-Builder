import { createRouter, createWebHashHistory } from 'vue-router'
import ChartBuilderPage from '../pages/ChartBuilderPage.vue'
import DashboardBuilderPage from '../pages/DashboardBuilderPage.vue'
import ReportBuilderPage from '../pages/ReportBuilderPage.vue'
import ProjectsPage from '../pages/ProjectsPage.vue'
import DatasetLibraryPage from '../pages/DatasetLibraryPage.vue'
import AdminDashboard from '../pages/AdminDashboard.vue'
import LoginPage from '../pages/LoginPage.vue'
import RegisterPage from '../pages/RegisterPage.vue'
import { useAuthStore } from '../stores/auth'
import { useProjectStore } from '../stores/projectStore'

declare module 'vue-router' {
    interface RouteMeta {
        requiresAuth?: boolean
        hideNav?: boolean
        roles?: string[]
        requiresProject?: boolean
    }
}

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
        path: '/register',
        name: 'register',
        component: RegisterPage,
        meta: {
            requiresAuth: false,
            hideNav: true
        }
    },
    {
        path: '/',
        redirect: '/projects'
    },
    {
        path: '/projects',
        name: 'projects',
        component: ProjectsPage,
        meta: { requiresAuth: true }
    },
    {
        path: '/charts',
        name: 'chart-builder',
        component: ChartBuilderPage,
        meta: { requiresAuth: true, requiresProject: true }
    },
    {
        path: '/datasets',
        name: 'dataset-library',
        component: DatasetLibraryPage,
        meta: { requiresAuth: true, requiresProject: true }
    },
    {
        path: '/dashboard',
        name: 'dashboard-builder',
        component: DashboardBuilderPage,
        meta: { requiresAuth: true, requiresProject: true }
    },
    {
        path: '/report',
        name: 'report-builder',
        component: ReportBuilderPage,
        meta: { requiresAuth: true, requiresProject: true }
    },
    {
        path: '/admin',
        name: 'admin-dashboard',
        component: AdminDashboard,
        meta: { requiresAuth: true, roles: ['Admin', 'SuperAdmin'] }
    }
]

const router = createRouter({
    history: createWebHashHistory(),
    routes
})

router.beforeEach((to, _from, next) => {
    const authStore = useAuthStore()
    const projectStore = useProjectStore()
    const isAuthenticated = authStore.isAuthenticated

    if (to.path === '/login' && isAuthenticated) {
        next('/')
        return
    }

    if (to.meta.requiresAuth && !isAuthenticated) {
        next('/login')
        return
    }

    const requiredRoles = to.meta.roles
    if (requiredRoles && requiredRoles.length > 0) {
        const userRole = authStore.userRole
        const isAllowed = requiredRoles.some((role) => role.toLowerCase() === userRole.toLowerCase())

        if (!isAllowed) {
            next('/dashboard')
            return
        }
    }

    if (to.meta.requiresProject && !projectStore.currentProject?.id) {
        next('/projects')
        return
    }

    next()
})

export default router
