import { createRouter, createWebHistory } from 'vue-router'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
  }
}

const LoginPage = () => import('../pages/LoginPage.vue')
const RegisterPage = () => import('../pages/RegisterPage.vue')
const MainLayout = () => import('../components/layout/MainLayout.vue')
const DashboardPage = () => import('../pages/DashboardPage.vue')
const ProjectPage = () => import('../pages/ProjectPage.vue')
const ChartBuilderPage = () => import('../views/ChartBuilderPage.vue')
const ReportBuilderPage = () => import('../pages/ReportBuilderPage.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', name: 'login', component: LoginPage, meta: { requiresAuth: false } },
    { path: '/register', name: 'register', component: RegisterPage, meta: { requiresAuth: false } },
    {
      path: '/',
      component: MainLayout,
      meta: { requiresAuth: true },
      children: [
        { path: 'dashboard', name: 'dashboard', component: DashboardPage, meta: { requiresAuth: true } },
        { path: 'project/:id', name: 'project', component: ProjectPage, meta: { requiresAuth: true } },
        {
          path: 'chart-builder',
          name: 'chart-builder',
          component: ChartBuilderPage,
          meta: { requiresAuth: true },
        },
        {
          path: 'report-builder',
          name: 'report-builder',
          component: ReportBuilderPage,
          meta: { requiresAuth: true },
        },
      ],
    },
  ],
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')

  if (to.meta.requiresAuth && !token) {
    next('/login')
    return
  }

  next()
})

export default router
