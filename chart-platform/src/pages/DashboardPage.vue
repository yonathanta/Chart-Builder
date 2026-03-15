<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProjectList, { type ProjectItem } from '../components/dashboard/ProjectList.vue'
import dashboardService, { type DashboardDetails, type DashboardRecord, type DashboardChartLayout } from '@legacy/services/dashboardService'
import chartService from '@legacy/services/chartService'
import DashboardChartRenderer from '../components/dashboard/DashboardChartRenderer.vue'

const router = useRouter()
const route = useRoute()

const projects: ProjectItem[] = [
  { id: '7441c7bc-1fdd-4f7b-91c3-3954fbec27ed', name: 'Population Trends', updatedAt: '2 hours ago' },
]

const dashboards = ref<DashboardRecord[]>([])
const activeDashboardDetails = ref<DashboardDetails | null>(null)
const chartsError = ref<string | null>(null)
const isSavingLayout = ref(false)

const activeProjectId = computed(() => {
  const projectIdFromRoute = route.query.projectId
  if (typeof projectIdFromRoute === 'string' && projectIdFromRoute.length > 0) {
    return projectIdFromRoute
  }

  return projects[0]?.id ?? ''
})

function formatDate(value: string | undefined): string {
  if (!value) {
    return '—'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleDateString()
}

async function loadDashboard(): Promise<void> {
  if (!activeProjectId.value) {
    dashboards.value = []
    activeDashboardDetails.value = null
    return
  }

  chartsError.value = null

  try {
    dashboards.value = await dashboardService.getDashboardsByProject(activeProjectId.value)
    
    if (dashboards.value.length > 0) {
      activeDashboardDetails.value = await dashboardService.getDashboard(dashboards.value[0]!.id)
    } else {
      activeDashboardDetails.value = null
    }
  } catch (error) {
    console.error('Failed to load dashboard:', error)
    chartsError.value = error instanceof Error ? error.message : 'Failed to load dashboard.'
  }
}

async function handleUpdateLayout(payload: { id: string; width: number; height: number }) {
  if (isSavingLayout.value) return
  isSavingLayout.value = true
  try {
    const layout = activeDashboardDetails.value?.charts.find(c => c.id === payload.id);
    if (!layout) return;

    await dashboardService.updateChartLayout({
      id: payload.id,
      positionX: layout.positionX,
      positionY: layout.positionY,
      width: payload.width,
      height: payload.height
    })
    
    // Update local state without refetching fully to be smooth
    layout.width = payload.width
    layout.height = payload.height
  } catch (err) {
    console.error('Failed to save layout:', err)
  } finally {
    isSavingLayout.value = false
  }
}

onMounted(async () => {
  await loadDashboard()
})

watch(activeProjectId, () => {
  loadDashboard()
})

function createNewProject(): void {
  router.push('/chart-builder')
}

const showShareModal = ref(false)
const embedCode = computed(() => {
  if (!activeDashboardDetails.value) return ''
  const baseUrl = window.location.origin
  const embedUrl = `${baseUrl}/api/dashboards/${activeDashboardDetails.value.id}/embed`
  return `<iframe src="${embedUrl}" width="100%" height="700" frameborder="0"></iframe>`
})

function copyEmbedCode() {
  navigator.clipboard.writeText(embedCode.value)
  alert('Embed code copied to clipboard!')
}

function openShareHtml() {
  if (!activeDashboardDetails.value) return
  window.open(`/api/dashboards/${activeDashboardDetails.value.id}/share-html`, '_blank')
}
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-header">
      <div>
        <h1>Welcome back</h1>
        <p>Start a new chart project or continue working on a previous one.</p>
      </div>
      <button type="button" class="create-button" @click="createNewProject">
        Create New Project
      </button>
    </section>

    <ProjectList :projects="projects" />

    <section class="charts-panel">
      <div class="charts-panel__header">
        <div>
          <h2>{{ activeDashboardDetails ? activeDashboardDetails.name : 'Dashboard' }}</h2>
          <p>Project: {{ activeProjectId || 'No project selected' }}</p>
        </div>
        <div v-if="activeDashboardDetails" class="header-actions">
          <button type="button" class="btn-secondary" @click="openShareHtml">View Shared HTML</button>
          <button type="button" class="btn-primary" @click="showShareModal = true">Share / Embed</button>
        </div>
      </div>

      <p v-if="chartsError" class="charts-panel__error">{{ chartsError }}</p>
      <p v-else-if="!activeDashboardDetails?.charts?.length" class="charts-panel__status">No charts added to dashboard yet.</p>

      <div v-else class="dashboard-grid">
        <DashboardChartRenderer
          v-for="layout in activeDashboardDetails.charts"
          :key="layout.id"
          :layout="layout"
          @update-layout="handleUpdateLayout"
        />
      </div>
    </section>

    <!-- Share Modal -->
    <div v-if="showShareModal" class="modal-overlay" @click.self="showShareModal = false">
      <div class="modal-content">
        <h3>Share Dashboard</h3>
        <p>Copy the code below to embed this dashboard in your website or application.</p>
        
        <div class="embed-code-box">
          <code>{{ embedCode }}</code>
        </div>
        
        <div class="modal-actions">
          <button class="btn-secondary" @click="showShareModal = false">Close</button>
          <button class="btn-primary" @click="copyEmbedCode">Copy Code</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.dashboard-header p {
  margin: 8px 0 0;
  color: #6b7280;
}

.create-button {
  height: 38px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  cursor: pointer;
}

.charts-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  padding: 16px;
}

.charts-panel__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.charts-panel__header h2 {
  margin: 0;
  font-size: 1.125rem;
}

.charts-panel__header p {
  margin: 0;
  color: #6b7280;
  font-size: 0.875rem;
}

.charts-panel__status {
  margin: 0;
  color: #6b7280;
}

.charts-panel__error {
  margin: 0;
  color: #dc2626;
}

.dashboard-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
  align-items: flex-start;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.btn-secondary {
  background: white;
  color: #1e293b;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 24px;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.embed-code-box {
  background: #f1f5f9;
  padding: 12px;
  border-radius: 6px;
  margin: 16px 0;
  font-size: 0.875rem;
  word-break: break-all;
  border: 1px solid #e2e8f0;
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

@media (max-width: 1024px) {
  .dashboard-grid {
    flex-direction: column;
    align-items: stretch;
  }
  
  .dashboard-grid > * {
    width: 100% !important;
    height: auto !important;
    min-height: 300px;
  }
}
</style>
