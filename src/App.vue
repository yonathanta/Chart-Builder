<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const showNav = computed(() => !route.meta.hideNav)
const userEmail = computed(() => authStore.userEmail)

function handleLogout(): void {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-container">
    <nav v-if="showNav" class="main-nav">
      <div class="nav-content">
        <div class="nav-brand">ECAStats Builder</div>
        <div class="nav-right">
          <div class="nav-links">
          <RouterLink to="/" class="nav-link" active-class="active">Chart Builder</RouterLink>
          <RouterLink to="/dashboard" class="nav-link" active-class="active">Dashboard Builder</RouterLink>
          <RouterLink to="/report" class="nav-link" active-class="active">Report Builder</RouterLink>
          </div>
          <div class="auth-actions">
            <span v-if="userEmail" class="user-email">{{ userEmail }}</span>
            <button type="button" class="logout-btn" @click="handleLogout">Logout</button>
          </div>
        </div>
      </div>
    </nav>
    <RouterView />
  </div>
</template>

<style>
/* Global styles moved from App.vue or kept if they were top-level */
:root {
  --nav-height: 60px;
}

body {
  margin: 0;
  padding: 0;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
}

.app-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.main-nav {
  height: var(--nav-height);
  background: #ffffff;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  padding: 0 24px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-content {
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.nav-brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: #1e293b;
}

.nav-links {
  display: flex;
  gap: 24px;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.auth-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-email {
  font-size: 0.85rem;
  color: #64748b;
}

.logout-btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  color: #334155;
  border-radius: 8px;
  height: 34px;
  padding: 0 12px;
  font-weight: 600;
  cursor: pointer;
}

.logout-btn:hover {
  background: #f8fafc;
}

.nav-link {
  text-decoration: none;
  color: #64748b;
  font-weight: 500;
  transition: color 0.2s;
}

.nav-link:hover {
  color: #1e293b;
}

.nav-link.active {
  color: #2563eb;
  position: relative;
}

.nav-link.active::after {
  content: '';
  position: absolute;
  bottom: -4px;
  left: 0;
  right: 0;
  height: 2px;
  background: #2563eb;
}
</style>
