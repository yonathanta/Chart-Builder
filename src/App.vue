<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterView, RouterLink } from 'vue-router'
import { useRoute } from 'vue-router'
import { useRouter } from 'vue-router'
import { useAuthStore } from './stores/auth'
import projectService, { type ProjectRecord } from './services/projectService'
import { useProjectStore } from './stores/projectStore'
import { useResponsiveStore } from './stores/responsiveStore'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const projectStore = useProjectStore()
const responsiveStore = useResponsiveStore()

const projects = ref<ProjectRecord[]>([])
const selectedProjectId = ref('')
const isLoadingProjects = ref(false)
const PROJECTS_CHANGED_EVENT = 'projects:changed'

const showNav = computed(() => !route.meta.hideNav)
const userEmail = computed(() => authStore.userEmail)
const hasSelectedProject = computed(() => selectedProjectId.value.length > 0)
const canAccessAdmin = computed(() => {
  const role = authStore.userRole.toLowerCase()
  return role === 'admin' || role === 'superadmin'
})

async function loadProjects(): Promise<void> {
  if (isLoadingProjects.value) {
    return
  }

  if (!authStore.isAuthenticated) {
    projects.value = []
    selectedProjectId.value = ''
    projectStore.setCurrentProject(null)
    return
  }

  isLoadingProjects.value = true
  try {
    projects.value = await projectService.getProjects()

    const currentId = projectStore.currentProject?.id
    const matchedCurrent = currentId
      ? projects.value.find((project) => project.id === currentId)
      : null

    if (matchedCurrent) {
      selectedProjectId.value = matchedCurrent.id
      projectStore.setCurrentProject({ id: matchedCurrent.id, name: matchedCurrent.name })
      return
    }

    const first = projects.value[0]
    if (first) {
      selectedProjectId.value = first.id
      projectStore.setCurrentProject({ id: first.id, name: first.name })
    } else {
      selectedProjectId.value = ''
      projectStore.setCurrentProject(null)
    }
  } catch {
    projects.value = []
    selectedProjectId.value = ''
    projectStore.setCurrentProject(null)
  } finally {
    isLoadingProjects.value = false
  }
}

watch(selectedProjectId, (projectId) => {
  if (!projectId) {
    projectStore.setCurrentProject(null)
    return
  }

  const project = projects.value.find((item) => item.id === projectId)
  if (project) {
    projectStore.setCurrentProject({ id: project.id, name: project.name })
  }
})

watch(
  () => authStore.isAuthenticated,
  async (isAuthenticated, wasAuthenticated) => {
    if (isAuthenticated && !wasAuthenticated) {
      await loadProjects()
    } else {
      projects.value = []
      selectedProjectId.value = ''
      projectStore.setCurrentProject(null)
    }
  }
)

function handleLogout(): void {
  authStore.logout()
  projectStore.setCurrentProject(null)
  projects.value = []
  selectedProjectId.value = ''
  router.push('/login')
}

function handleProjectsChanged(): void {
  void loadProjects()
}

onMounted(() => {
  responsiveStore.initialize()
  window.addEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged)
})

onBeforeUnmount(() => {
  responsiveStore.teardown()
  window.removeEventListener(PROJECTS_CHANGED_EVENT, handleProjectsChanged)
})

</script>

<template>
  <div class="app-container" :class="[`app--${responsiveStore.deviceType}`]">
    <nav v-if="showNav" class="main-nav">
      <div class="nav-content">
        <div class="nav-brand">ECAStats Builder</div>
        <div class="nav-right">
          <div class="nav-links">
          <RouterLink to="/projects" class="nav-link" active-class="active">Projects</RouterLink>
          <RouterLink v-if="hasSelectedProject" to="/datasets" class="nav-link" active-class="active">Datasets</RouterLink>
          <RouterLink v-if="hasSelectedProject" to="/charts" class="nav-link" active-class="active">Charts</RouterLink>
          <RouterLink v-if="hasSelectedProject" to="/report" class="nav-link" active-class="active">Reports</RouterLink>
          <RouterLink v-if="canAccessAdmin" to="/admin" class="nav-link" active-class="active">Admin</RouterLink>
          </div>
          <div class="project-picker">
            <label for="projectSelect">Project</label>
            <select
              id="projectSelect"
              v-model="selectedProjectId"
              :disabled="projects.length === 0"
            >
              <option value="" disabled>Select project</option>
              <option v-for="project in projects" :key="project.id" :value="project.id">
                {{ project.name }}
              </option>
            </select>
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

.project-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-picker label {
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}

.project-picker select {
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 8px;
  background: #fff;
  min-width: 160px;
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

@media (max-width: 1024px) {
  .main-nav {
    height: auto;
    min-height: var(--nav-height);
    padding: 8px 14px;
  }

  .nav-content {
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
  }

  .nav-right {
    width: 100%;
    flex-wrap: wrap;
    gap: 10px;
    justify-content: space-between;
  }

  .nav-links {
    order: 2;
    width: 100%;
    gap: 12px;
    flex-wrap: wrap;
  }
}

@media (max-width: 767px) {
  .project-picker label,
  .user-email {
    display: none;
  }

  .project-picker select {
    min-width: 120px;
  }

  .nav-brand {
    font-size: 1rem;
  }

  .logout-btn {
    height: 30px;
    padding: 0 10px;
  }
}
</style>
