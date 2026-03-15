<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import projectService, { type ProjectRecord } from '../services/projectService'
import { useProjectStore } from '../stores/projectStore'

const projectStore = useProjectStore()

const projects = ref<ProjectRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const message = ref('')

const newProjectName = ref('')
const newProjectDescription = ref('')

const selectedProjectId = computed(() => projectStore.currentProject?.id ?? '')

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null) {
    return fallback
  }

  const response = (error as {
    response?: {
      status?: number
      data?: {
        message?: string
        error?: string
        title?: string
        details?: string[]
        errors?: Record<string, string[]>
      } | string
    }
    message?: string
  }).response

  const responseData = response?.data

  if (typeof responseData === 'string' && responseData.trim().length > 0) {
    return responseData
  }

  if (typeof responseData === 'object' && responseData !== null) {
    if (responseData.errors && typeof responseData.errors === 'object') {
      const firstFieldError = Object.values(responseData.errors)
        .find((messages) => Array.isArray(messages) && messages.length > 0)
        ?.[0]

      if (typeof firstFieldError === 'string' && firstFieldError.trim().length > 0) {
        return firstFieldError
      }
    }

    if (Array.isArray(responseData.details) && responseData.details.length > 0) {
      const firstDetail = responseData.details.find((value) => typeof value === 'string' && value.trim().length > 0)
      if (firstDetail) {
        return firstDetail
      }
    }

    const apiMessage = responseData.message ?? responseData.error ?? responseData.title
    if (typeof apiMessage === 'string' && apiMessage.trim().length > 0) {
      return apiMessage
    }
  }

  if (response?.status === 403) {
    return 'You are not allowed to create projects with this account role.'
  }

  if (response?.status === 401) {
    return 'Your session is not authorized. Please sign in again.'
  }

  const maybeMessage = (error as { message?: string }).message
  if (typeof maybeMessage === 'string' && maybeMessage.trim().length > 0) {
    return maybeMessage
  }

  return fallback
}

function setMessage(text: string): void {
  message.value = text
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
    }
  }, 2500)
}

async function loadProjects(): Promise<void> {
  loading.value = true
  try {
    projects.value = await projectService.getProjects()

    if (!projectStore.currentProject && projects.value.length > 0) {
      const first = projects.value[0]
      if (first) {
        projectStore.setCurrentProject({ id: first.id, name: first.name })
      }
    }
  } catch {
    setMessage('Failed to load projects.')
  } finally {
    loading.value = false
  }
}

function selectProject(project: ProjectRecord): void {
  projectStore.setCurrentProject({
    id: project.id,
    name: project.name,
  })
  setMessage(`Selected project: ${project.name}`)
}

async function createProject(): Promise<void> {
  const name = newProjectName.value.trim()
  if (!name || saving.value) {
    return
  }

  saving.value = true
  try {
    const created = await projectService.createProject({
      name,
      description: newProjectDescription.value.trim() || undefined,
    })

    projects.value = [created, ...projects.value]
    projectStore.setCurrentProject({ id: created.id, name: created.name })

    newProjectName.value = ''
    newProjectDescription.value = ''
    setMessage('Project created and selected.')
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to create project.'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadProjects()
})
</script>

<template>
  <main class="projects-page">
    <section class="create-panel">
      <h2>Projects</h2>
      <p class="hint">Create or select a project to unlock Charts, Dashboards, and Reports.</p>

      <div class="create-grid">
        <input v-model="newProjectName" placeholder="Project name" />
        <input v-model="newProjectDescription" placeholder="Description (optional)" />
        <button :disabled="saving || !newProjectName.trim()" @click="createProject">
          {{ saving ? 'Creating...' : 'Create Project' }}
        </button>
      </div>

      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <section class="list-panel">
      <p v-if="loading" class="hint">Loading projects...</p>
      <p v-else-if="projects.length === 0" class="hint">No projects yet.</p>

      <button
        v-for="project in projects"
        :key="project.id"
        class="project-item"
        :class="{ active: project.id === selectedProjectId }"
        @click="selectProject(project)"
      >
        <div class="title">{{ project.name }}</div>
        <div class="meta">{{ project.description || 'No description' }}</div>
      </button>
    </section>
  </main>
</template>

<style scoped>
.projects-page {
  padding: 16px;
  display: grid;
  gap: 14px;
  background: #f8fafc;
  min-height: calc(100vh - var(--nav-height));
}

.create-panel,
.list-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}

h2 {
  margin: 0 0 6px;
}

.hint {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

.message {
  color: #0f766e;
  font-size: 13px;
  margin-top: 8px;
}

.create-grid {
  margin-top: 10px;
  display: grid;
  grid-template-columns: minmax(160px, 260px) minmax(180px, 320px) auto;
  gap: 8px;
}

input {
  height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
}

button {
  height: 38px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  padding: 0 12px;
  cursor: pointer;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.project-item {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  margin-top: 8px;
  padding: 10px;
  color: #0f172a;
}

.project-item.active {
  border-color: #2563eb;
  background: #eff6ff;
}

.title {
  font-weight: 600;
}

.meta {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
}
</style>
