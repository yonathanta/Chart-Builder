<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()

const pageTitle = computed(() => {
  const map: Record<string, string> = {
    dashboard: 'Dashboard',
    'chart-builder': 'Charts',
    'report-builder': 'Report Builder',
    project: 'Project',
  }
  const name = typeof route.name === 'string' ? route.name : ''
  return map[name] ?? 'Dashboard'
})

function handleLogout() {
  authStore.logout()
  router.push('/login')
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="brand-block">
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
        </div>
        <div>
          <p class="brand-name">ECAStats</p>
          <p class="brand-sub">Chartbuilder</p>
        </div>
      </div>

      <nav class="sidebar-nav">
        <RouterLink to="/dashboard" class="nav-link">
          <span class="nav-icon">▦</span>
          Dashboard
        </RouterLink>
        <RouterLink to="/chart-builder" class="nav-link">
          <span class="nav-icon">▤</span>
          Charts
        </RouterLink>
        <RouterLink to="/report-builder" class="nav-link">
          <span class="nav-icon">▢</span>
          Report Builder
        </RouterLink>
      </nav>

      <button type="button" class="logout-btn" @click="handleLogout">
        <span class="nav-icon">⟵</span>
        Sign Out
      </button>
    </aside>

    <div class="content-shell">
      <header class="top-nav">
        <div class="top-nav-left">
          <button class="icon-btn" type="button" aria-label="Toggle menu">
            ▢
          </button>
          <div>
            <p class="page-title">{{ pageTitle }}</p>
            <p class="page-sub">Welcome back! Here’s your overview.</p>
          </div>
        </div>
      </header>

      <main class="page-content">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 240px 1fr;
  background: #f8fafc;
}

.sidebar {
  border-right: 1px solid #e5e7eb;
  padding: 24px 16px;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background: #ffffff;
}

.brand-block {
  display: flex;
  gap: 12px;
  align-items: center;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: #e2f7f7;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #0ea5a8;
}

.brand-mark svg {
  width: 22px;
  height: 22px;
}

.brand-name {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.brand-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.nav-link {
  color: #0f172a;
  text-decoration: none;
  padding: 8px 10px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.nav-link.router-link-active {
  background: #eef2f7;
  font-weight: 600;
}

.nav-icon {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: #f1f5f9;
  color: #475569;
  font-size: 12px;
}

.logout-btn {
  margin-top: auto;
  padding: 8px 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #475569;
}

.content-shell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.top-nav {
  height: 64px;
  padding: 12px 24px;
  border-bottom: 1px solid #e5e7eb;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.top-nav-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.icon-btn {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  cursor: pointer;
}

.page-title {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
}

.page-sub {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.page-content {
  flex: 1;
  padding: 24px;
  overflow: auto;
  background: #f8fafc;
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }

  .sidebar {
    flex-direction: row;
    align-items: center;
    gap: 16px;
    border-right: 0;
    border-bottom: 1px solid #e5e7eb;
  }

  .sidebar-nav {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .logout-btn {
    margin-top: 0;
  }
}
</style>
