<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProjectList, { type ProjectItem } from '../components/dashboard/ProjectList.vue'
import chartService from '@legacy/services/chartService'

const router = useRouter()
const route = useRoute()

type DashboardChart = {
  id: string
  name: string
  chartType: string
  createdAt?: string
  CreatedAt?: string
}

const projects: ProjectItem[] = [
  { id: 'proj-001', name: 'Population Trends 2026', updatedAt: '2 hours ago' },
  { id: 'proj-002', name: 'Regional GDP Comparison', updatedAt: 'Yesterday' },
  { id: 'proj-003', name: 'Health Access Overview', updatedAt: '3 days ago' },
]

const charts = ref<DashboardChart[]>([])
const isLoadingCharts = ref(false)
const chartsError = ref<string | null>(null)
const deletingChartId = ref<string | null>(null)

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

async function loadCharts(): Promise<void> {
  if (!activeProjectId.value) {
    charts.value = []
    return
  }

  isLoadingCharts.value = true
  chartsError.value = null

  try {
    const response = await chartService.getCharts(activeProjectId.value)
    charts.value = Array.isArray(response) ? (response as DashboardChart[]) : []
  } catch (error) {
    console.error('Failed to load charts:', error)
    chartsError.value = error instanceof Error ? error.message : 'Failed to load charts.'
  } finally {
    isLoadingCharts.value = false
  }
}

async function editChart(chartId: string): Promise<void> {
  try {
    await chartService.getChart(chartId)
    router.push({
      name: 'chart-builder',
      query: {
        projectId: activeProjectId.value,
        chartId,
      },
    })
  } catch (error) {
    console.error('Failed to load chart for editing:', error)
    chartsError.value = error instanceof Error ? error.message : 'Failed to open chart for editing.'
  }
}

async function deleteChart(chartId: string): Promise<void> {
  if (deletingChartId.value) {
    return
  }

  deletingChartId.value = chartId
  chartsError.value = null

  try {
    await chartService.deleteChart(chartId)
    charts.value = charts.value.filter((chart) => chart.id !== chartId)
  } catch (error) {
    console.error('Failed to delete chart:', error)
    chartsError.value = error instanceof Error ? error.message : 'Failed to delete chart.'
  } finally {
    deletingChartId.value = null
  }
}

onMounted(async () => {
  await loadCharts()
})

function createNewProject(): void {
  router.push('/chart-builder')
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
        <h2>Charts</h2>
        <p>Project: {{ activeProjectId || 'No project selected' }}</p>
      </div>

      <p v-if="isLoadingCharts" class="charts-panel__status">Loading charts…</p>
      <p v-else-if="chartsError" class="charts-panel__error">{{ chartsError }}</p>
      <p v-else-if="charts.length === 0" class="charts-panel__status">No charts found.</p>

      <ul v-else class="charts-list">
        <li v-for="chart in charts" :key="chart.id" class="charts-list__item">
          <div class="chart-meta">
            <h3>{{ chart.name }}</h3>
            <p>Type: {{ chart.chartType }}</p>
            <p>Created: {{ formatDate(chart.createdAt ?? chart.CreatedAt) }}</p>
          </div>
          <div class="chart-actions">
            <button type="button" class="edit-button" @click="editChart(chart.id)">Edit</button>
            <button
              type="button"
              class="delete-button"
              :disabled="deletingChartId === chart.id"
              @click="deleteChart(chart.id)"
            >
              {{ deletingChartId === chart.id ? 'Deleting…' : 'Delete' }}
            </button>
          </div>
        </li>
      </ul>
    </section>
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

.charts-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.charts-list__item {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.chart-meta h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.chart-meta p {
  margin: 2px 0;
  color: #4b5563;
  font-size: 0.875rem;
}

.chart-actions {
  display: flex;
  gap: 8px;
}

.edit-button,
.delete-button {
  height: 34px;
  padding: 0 12px;
  border-radius: 6px;
  border: 1px solid #d1d5db;
  background: #ffffff;
  cursor: pointer;
}

.delete-button {
  color: #b91c1c;
}

.delete-button:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}
</style>
