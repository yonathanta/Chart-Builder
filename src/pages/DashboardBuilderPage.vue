<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DashboardSelectionBar from '../components/dashboard-builder/DashboardSelectionBar.vue'
import DashboardLayoutGrid, { type GridChartItem } from '../components/dashboard-builder/DashboardLayoutGrid.vue'
import ChartRenderer from '../components/ChartRenderer.vue'
import dashboardService, { type DashboardChartLayout, type DashboardRecord } from '../services/dashboardService'
import projectService, { type ProjectRecord } from '../services/projectService'
import chartService from '../services/chartService'
import datasetService from '../services/datasetService'
import { useProjectStore } from '../stores/projectStore'
import { useResponsiveStore } from '../stores/responsiveStore'

type ApiChart = {
  id?: string
  Id?: string
  name?: string
  Name?: string
  chartType?: string
  ChartType?: string
  configJson?: string
  ConfigJson?: string
  styleJson?: string
  StyleJson?: string
  datasetId?: string
  DatasetId?: string
  projectId?: string
  ProjectId?: string
  configuration?: string
  Configuration?: string
  dataset?: string
  Dataset?: string
}

type ProjectChartOption = {
  id: string
  name: string
  chartType: string
  previewChart: {
    id: string
    type: string
    config: unknown
    dataset: unknown
  } | null
}

const projectStore = useProjectStore()
const responsiveStore = useResponsiveStore()

const projects = ref<ProjectRecord[]>([])
const dashboards = ref<DashboardRecord[]>([])
const availableCharts = ref<ProjectChartOption[]>([])
const selectedProjectId = ref('')
const selectedDashboardId = ref('')
const gridItems = ref<GridChartItem[]>([])
const initialSnapshot = ref<Map<string, string>>(new Map())

const loading = ref(false)
const saving = ref(false)
const message = ref('')
const showChartPicker = ref(false)

const isMobile = computed(() => responsiveStore.deviceType === 'mobile')
const isTablet = computed(() => responsiveStore.deviceType === 'tablet')

const hasPendingLayoutChanges = computed(() => {
  return gridItems.value.some((item) => {
    const snapshot = initialSnapshot.value.get(item.layoutId)
    const current = `${item.x}:${item.y}:${item.w}:${item.h}`
    return snapshot !== current
  })
})

function setMessage(text: string): void {
  message.value = text
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
    }
  }, 2500)
}

function parseJson(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value
  }

  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}

async function resolveDataset(dataset: unknown): Promise<unknown> {
  const parsed = parseJson(dataset)

  if (typeof parsed === 'string' && parsed.startsWith('http')) {
    try {
      const response = await fetch(parsed)
      const body = await response.json()
      return (body as any)?.data ?? body
    } catch {
      return null
    }
  }

  if (parsed && typeof parsed === 'object') {
    const source = (parsed as any)?.query?.source
    if (typeof source === 'string') {
      try {
        const response = await fetch(source)
        const body = await response.json()
        return (body as any)?.data ?? body
      } catch {
        return parsed
      }
    }
  }

  return parsed
}

async function resolveDatasetById(datasetId: string): Promise<unknown> {
  try {
    const dataset = await datasetService.getDataset(datasetId)
    const parsed = parseJson(dataset.dataJson)

    if (Array.isArray(parsed)) {
      return parsed
    }

    if (parsed && typeof parsed === 'object') {
      const wrapped = (parsed as { data?: unknown }).data
      if (Array.isArray(wrapped)) {
        return wrapped
      }
    }

    return []
  } catch {
    return null
  }
}

async function loadProjects(): Promise<void> {
  loading.value = true
  try {
    projects.value = await projectService.getProjects()

    if (projectStore.currentProject?.id) {
      selectedProjectId.value = projectStore.currentProject.id
    } else if (projects.value.length > 0) {
      selectedProjectId.value = projects.value[0].id
    }
  } catch (error) {
    console.error('Failed to load projects', error)
    setMessage('Failed to load projects.')
  } finally {
    loading.value = false
  }
}

async function loadDashboards(projectId: string): Promise<void> {
  if (!projectId) {
    dashboards.value = []
    selectedDashboardId.value = ''
    gridItems.value = []
    return
  }

  loading.value = true
  try {
    dashboards.value = await dashboardService.getDashboardsByProject(projectId)
    selectedDashboardId.value = dashboards.value[0]?.id ?? ''
  } catch (error) {
    console.error('Failed to load dashboards', error)
    dashboards.value = []
    selectedDashboardId.value = ''
    setMessage('Failed to load dashboards.')
  } finally {
    loading.value = false
  }
}

async function loadCharts(projectId: string): Promise<void> {
  if (!projectId) {
    availableCharts.value = []
    return
  }

  try {
    const response = await chartService.getCharts(projectId)
    if (!Array.isArray(response)) {
      availableCharts.value = []
      return
    }

    const cards = await Promise.all(
      response.map(async (item) => {
        const chart = item as ApiChart
        const chartId = String(chart.id ?? chart.Id ?? '')
        const chartName = String(chart.name ?? chart.Name ?? 'Untitled chart')
        const chartType = String(chart.chartType ?? chart.ChartType ?? 'unknown')
        const configRaw = chart.configJson ?? chart.ConfigJson ?? chart.configuration ?? chart.Configuration ?? {}
        const styleRaw = chart.styleJson ?? chart.StyleJson ?? {}
        const datasetId = String(chart.datasetId ?? chart.DatasetId ?? '')
        const datasetRaw = chart.dataset ?? chart.Dataset ?? {}

        const parsedConfig = parseJson(configRaw)
        const parsedStyle = parseJson(styleRaw)
        const mergedConfig = parsedConfig && typeof parsedConfig === 'object'
          ? {
              ...(parsedConfig as Record<string, unknown>),
              style: {
                ...(((parsedConfig as Record<string, unknown>).style as Record<string, unknown> | undefined) ?? {}),
                ...(parsedStyle && typeof parsedStyle === 'object' ? (parsedStyle as Record<string, unknown>) : {}),
              },
            }
          : parsedConfig

        const resolvedDataset = datasetId
          ? await resolveDatasetById(datasetId)
          : await resolveDataset(datasetRaw)

        return {
          id: chartId,
          name: chartName,
          chartType,
          previewChart: {
            id: chartId,
            type: chartType,
            config: mergedConfig,
            dataset: resolvedDataset,
          },
        } satisfies ProjectChartOption
      })
    )

    availableCharts.value = cards
  } catch (error) {
    console.error('Failed to load project charts', error)
    availableCharts.value = []
  }
}

async function hydrateGridItems(layouts: DashboardChartLayout[]): Promise<GridChartItem[]> {
  const resolved = await Promise.all(
    layouts.map(async (layout) => {
      let chartPayload: GridChartItem['chart'] = null

      try {
        const response = (await chartService.getChart(layout.chartId)) as ApiChart
        const chartId = String(response.id ?? response.Id ?? layout.chartId)
        const chartType = String(response.chartType ?? response.ChartType ?? 'bar')
        const configRaw = response.configJson ?? response.ConfigJson ?? response.configuration ?? response.Configuration ?? {}
        const datasetId = String(response.datasetId ?? response.DatasetId ?? '')
        const datasetRaw = response.dataset ?? response.Dataset ?? {}

        const resolvedDataset = datasetId
          ? await resolveDatasetById(datasetId)
          : await resolveDataset(datasetRaw)

        chartPayload = {
          id: chartId,
          type: chartType,
          config: parseJson(configRaw),
          dataset: resolvedDataset,
        }
      } catch (error) {
        console.error(`Failed to load chart ${layout.chartId}`, error)
      }

      return {
        layoutId: layout.id,
        chartId: layout.chartId,
        chartName: layout.chartName,
        x: layout.positionX,
        y: layout.positionY,
        w: layout.width,
        h: layout.height,
        chart: chartPayload,
      }
    })
  )

  return resolved
}

async function loadDashboardDetails(dashboardId: string): Promise<void> {
  if (!dashboardId) {
    gridItems.value = []
    initialSnapshot.value = new Map()
    return
  }

  loading.value = true
  try {
    const details = await dashboardService.getDashboard(dashboardId)
    gridItems.value = await hydrateGridItems(details.charts)

    const snapshot = new Map<string, string>()
    for (const item of gridItems.value) {
      snapshot.set(item.layoutId, `${item.x}:${item.y}:${item.w}:${item.h}`)
    }
    initialSnapshot.value = snapshot
  } catch (error) {
    console.error('Failed to load dashboard details', error)
    gridItems.value = []
    initialSnapshot.value = new Map()
    setMessage('Failed to load dashboard layout.')
  } finally {
    loading.value = false
  }
}

function handleMove(payload: { id: string; x: number; y: number }): void {
  const target = gridItems.value.find((item) => item.layoutId === payload.id)
  if (!target) {
    return
  }

  target.x = payload.x
  target.y = payload.y
}

function handleResize(payload: { id: string; w: number; h: number }): void {
  const target = gridItems.value.find((item) => item.layoutId === payload.id)
  if (!target) {
    return
  }

  target.w = payload.w
  target.h = payload.h
}

function startProjectChartDrag(chartId: string, event: DragEvent): void {
  if (!selectedDashboardId.value || !chartId || !event.dataTransfer) {
    return
  }

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-chart-id', chartId)
}

async function addChartToDashboard(chartId: string, x?: number, y?: number): Promise<void> {
  if (saving.value || !selectedDashboardId.value || !chartId) {
    return
  }

  if (gridItems.value.some((item) => item.chartId === chartId)) {
    setMessage('Chart is already in this dashboard.')
    return
  }

  const preferredX = typeof x === 'number' ? x : 0
  const preferredY = typeof y === 'number' ? y : (gridItems.value.length > 0 ? Math.max(...gridItems.value.map((item) => item.y + item.h)) : 0)

  saving.value = true
  try {
    await dashboardService.addChartToDashboard({
      dashboardId: selectedDashboardId.value,
      chartId,
      positionX: preferredX,
      positionY: preferredY,
      width: 4,
      height: 3,
    })

    await loadDashboardDetails(selectedDashboardId.value)
    setMessage('Chart added to dashboard.')
  } catch (error: any) {
    const status = error?.response?.status
    if (status === 409) {
      setMessage('Chart is already in this dashboard.')
      return
    }

    console.error('Failed to add chart to dashboard', error)
    setMessage('Failed to add chart to dashboard.')
  } finally {
    saving.value = false
  }
}

async function saveLayout(): Promise<void> {
  if (saving.value || !hasPendingLayoutChanges.value) {
    return
  }

  saving.value = true
  try {
    const changedItems = gridItems.value.filter((item) => {
      const snapshot = initialSnapshot.value.get(item.layoutId)
      const current = `${item.x}:${item.y}:${item.w}:${item.h}`
      return snapshot !== current
    })

    await Promise.all(
      changedItems.map((item) =>
        dashboardService.updateChartLayout({
          id: item.layoutId,
          positionX: item.x,
          positionY: item.y,
          width: item.w,
          height: item.h,
        })
      )
    )

    const newSnapshot = new Map(initialSnapshot.value)
    for (const item of changedItems) {
      newSnapshot.set(item.layoutId, `${item.x}:${item.y}:${item.w}:${item.h}`)
    }
    initialSnapshot.value = newSnapshot

    setMessage('Layout saved.')
  } catch (error) {
    console.error('Failed to save dashboard layout', error)
    setMessage('Failed to save layout changes.')
  } finally {
    saving.value = false
  }
}

watch(selectedProjectId, async (projectId) => {
  const selectedProject = projects.value.find((project) => project.id === projectId)
  if (selectedProject) {
    projectStore.setCurrentProject({ id: selectedProject.id, name: selectedProject.name })
  }

  await Promise.all([loadDashboards(projectId), loadCharts(projectId)])
})

watch(selectedDashboardId, async (dashboardId) => {
  await loadDashboardDetails(dashboardId)
})

onMounted(async () => {
  showChartPicker.value = !isMobile.value

  await loadProjects()
  if (selectedProjectId.value) {
    await Promise.all([loadDashboards(selectedProjectId.value), loadCharts(selectedProjectId.value)])
  }
  if (selectedDashboardId.value) {
    await loadDashboardDetails(selectedDashboardId.value)
  }
})

watch(
  () => responsiveStore.deviceType,
  (deviceType) => {
    if (deviceType === 'mobile') {
      showChartPicker.value = false
      return
    }

    showChartPicker.value = true
  },
  { immediate: true },
)
</script>

<template>
  <main class="dashboard-builder-page" :class="[`dashboard-builder-page--${responsiveStore.deviceType}`]">
    <header class="topbar">
      <DashboardSelectionBar
        :projects="projects"
        :dashboards="dashboards"
        :selected-project-id="selectedProjectId"
        :selected-dashboard-id="selectedDashboardId"
        :loading="loading || saving"
        @update:selected-project-id="selectedProjectId = $event"
        @update:selected-dashboard-id="selectedDashboardId = $event"
      />

      <button class="save-btn" :disabled="saving || !hasPendingLayoutChanges" @click="saveLayout">
        {{ saving ? 'Saving...' : 'Save Layout Changes' }}
      </button>

      <button
        v-if="isMobile"
        class="save-btn save-btn--secondary"
        :disabled="loading"
        @click="showChartPicker = !showChartPicker"
      >
        {{ showChartPicker ? 'Hide Charts' : 'Show Charts' }}
      </button>
    </header>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="loading" class="hint">Loading...</p>

    <section class="content-grid" v-if="!loading">
      <aside class="chart-picker">
        <h2>Project Charts</h2>
        <p class="hint">Drag a chart into the dashboard grid, or click to add.</p>

        <button
          v-for="chart in availableCharts"
          :key="chart.id"
          class="chart-item chart-card"
          :disabled="saving || !selectedDashboardId"
          draggable="true"
          @dragstart="startProjectChartDrag(chart.id, $event)"
          @click="addChartToDashboard(chart.id)"
        >
          <div class="chart-card__head">
            <span class="chart-card__name">{{ chart.name }}</span>
            <small>{{ chart.chartType }}</small>
          </div>
          <div class="chart-card__thumb">
            <ChartRenderer v-if="chart.previewChart" :chart="chart.previewChart" />
            <div v-else class="placeholder">Preview unavailable</div>
          </div>
        </button>

        <p v-if="availableCharts.length === 0" class="hint">No charts found for this project.</p>
      </aside>

      <aside v-if="isMobile && showChartPicker" class="chart-picker chart-picker--mobile">
        <h2>Project Charts</h2>
        <p class="hint">Tap to add chart to dashboard.</p>

        <button
          v-for="chart in availableCharts"
          :key="`mobile-${chart.id}`"
          class="chart-item chart-card"
          :disabled="saving || !selectedDashboardId"
          @click="addChartToDashboard(chart.id)"
        >
          <div class="chart-card__head">
            <span class="chart-card__name">{{ chart.name }}</span>
            <small>{{ chart.chartType }}</small>
          </div>
        </button>
      </aside>

      <DashboardLayoutGrid
        :items="gridItems"
        :device-type="responsiveStore.deviceType"
        @move="handleMove"
        @resize="handleResize"
        @add-chart="addChartToDashboard($event.chartId, $event.x, $event.y)"
      />
    </section>
  </main>
</template>

<style scoped>
.dashboard-builder-page {
  height: calc(100vh - var(--nav-height));
  overflow: auto;
  padding: 16px;
  background: #f8fafc;
}

.topbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.save-btn {
  height: 38px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: white;
  padding: 0 14px;
  cursor: pointer;
}

.save-btn--secondary {
  border-color: #cbd5e1;
  background: #ffffff;
  color: #334155;
}

.save-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.message {
  color: #0f766e;
  font-size: 13px;
  margin-bottom: 8px;
}

.hint {
  color: #64748b;
  font-size: 13px;
}

.content-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
}

.chart-picker {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.chart-picker h2 {
  margin: 0;
  font-size: 16px;
}

.chart-item {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: grab;
}

.chart-card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.chart-card__head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.chart-card__name {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-card__thumb {
  height: 120px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.chart-item:active {
  cursor: grabbing;
}

.chart-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chart-item small {
  color: #64748b;
}

@media (max-width: 1024px) {
  .content-grid {
    grid-template-columns: 1fr;
  }

  .topbar {
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .chart-picker {
    order: 2;
  }
}

@media (max-width: 767px) {
  .dashboard-builder-page {
    padding: 10px;
  }

  .chart-picker {
    display: none;
  }

  .chart-picker--mobile {
    display: flex;
  }

  .chart-card__thumb {
    height: 96px;
  }
}
</style>
