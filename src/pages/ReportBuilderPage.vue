<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ReportSelectionBar from '../components/report-builder/ReportSelectionBar.vue'
import ReportChartLayout, { type ReportLayoutItem } from '../components/report-builder/ReportChartLayout.vue'
import ChartRenderer from '../components/ChartRenderer.vue'
import projectService, { type ProjectRecord } from '../services/projectService'
import chartService from '../services/chartService'
import datasetService from '../services/datasetService'
import reportService, {
  type ReportChartRecord,
  type ReportRecord,
} from '../services/reportService'
import { useProjectStore } from '../stores/projectStore'

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

const projectStore = useProjectStore()

const projects = ref<ProjectRecord[]>([])
const reports = ref<ReportRecord[]>([])
const availableCharts = ref<ProjectChartOption[]>([])
const layoutItems = ref<ReportLayoutItem[]>([])

const selectedProjectId = ref('')
const selectedReportId = ref('')

const loading = ref(false)
const saving = ref(false)
const message = ref('')

const sortedLayoutItems = computed(() =>
  [...layoutItems.value].sort((left, right) => left.orderIndex - right.orderIndex)
)

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
      return (body as { data?: unknown }).data ?? body
    } catch {
      return null
    }
  }

  if (parsed && typeof parsed === 'object') {
    const source = (parsed as { query?: { source?: unknown } }).query?.source
    if (typeof source === 'string') {
      try {
        const response = await fetch(source)
        const body = await response.json()
        return (body as { data?: unknown }).data ?? body
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

async function toRenderableChart(response: ApiChart, fallbackId = ''): Promise<ReportLayoutItem['chart']> {
  const configRaw = response.configJson ?? response.ConfigJson ?? response.configuration ?? response.Configuration ?? {}
  const styleRaw = response.styleJson ?? response.StyleJson ?? {}
  const parsedConfig = parseJson(configRaw) as {
    persistedState?: {
      filteredRows?: unknown
      allRows?: unknown
    }
    style?: Record<string, unknown>
  }
  const parsedStyle = parseJson(styleRaw)
  const datasetId = String(response.datasetId ?? response.DatasetId ?? '')
  const datasetRaw = response.dataset ?? response.Dataset ?? {}

  const persistedFilteredRows = parsedConfig?.persistedState?.filteredRows
  const persistedAllRows = parsedConfig?.persistedState?.allRows

  const resolvedDataset = Array.isArray(persistedFilteredRows)
    ? persistedFilteredRows
    : Array.isArray(persistedAllRows)
      ? persistedAllRows
      : datasetId
        ? await resolveDatasetById(datasetId)
        : await resolveDataset(datasetRaw)

  return {
    id: String(response.id ?? response.Id ?? fallbackId),
    type: String(response.chartType ?? response.ChartType ?? 'bar'),
    config: {
      ...(parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {}),
      style: {
        ...(((parsedConfig && typeof parsedConfig === 'object' ? parsedConfig.style : undefined) as Record<string, unknown> | undefined) ?? {}),
        ...(parsedStyle && typeof parsedStyle === 'object' ? (parsedStyle as Record<string, unknown>) : {}),
      },
    },
    dataset: resolvedDataset,
  }
}

async function getRenderableChart(chartId: string): Promise<ReportLayoutItem['chart']> {
  try {
    const response = (await chartService.getChart(chartId)) as ApiChart
    return await toRenderableChart(response, chartId)
  } catch {
    return null
  }
}

async function hydrateLayoutItems(charts: ReportChartRecord[]): Promise<ReportLayoutItem[]> {
  const hydrated = await Promise.all(
    charts.map(async (item) => ({
      id: item.id,
      chartId: item.chartId,
      chartName: item.chartName,
      orderIndex: item.orderIndex,
      chart: await getRenderableChart(item.chartId),
    }))
  )

  return hydrated.sort((left, right) => left.orderIndex - right.orderIndex)
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
  } catch {
    setMessage('Failed to load projects.')
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

    availableCharts.value = await Promise.all(
      response.map(async (item) => {
        const chart = item as ApiChart
        const chartId = String(chart.id ?? chart.Id ?? '')
        const chartName = String(chart.name ?? chart.Name ?? 'Untitled chart')
        const chartType = String(chart.chartType ?? chart.ChartType ?? 'unknown')

        return {
          id: chartId,
          name: chartName,
          chartType,
          previewChart: await toRenderableChart(chart, chartId),
        }
      })
    )
  } catch {
    availableCharts.value = []
    setMessage('Failed to load project charts.')
  }
}

async function loadReports(projectId: string): Promise<void> {
  if (!projectId) {
    reports.value = []
    selectedReportId.value = ''
    layoutItems.value = []
    return
  }

  loading.value = true

  try {
    reports.value = await reportService.getReportsByProject(projectId)
    selectedReportId.value = reports.value[0]?.id ?? ''
  } catch {
    reports.value = []
    selectedReportId.value = ''
    layoutItems.value = []
    setMessage('Unable to load reports for this project.')
  } finally {
    loading.value = false
  }
}

async function loadReportDetails(reportId: string): Promise<void> {
  if (!reportId) {
    layoutItems.value = []
    return
  }

  loading.value = true

  try {
    const details = await reportService.getReportById(reportId)
    layoutItems.value = await hydrateLayoutItems(details.charts)
  } catch {
    layoutItems.value = []
    setMessage('Unable to load the selected report. It may not belong to your account.')
  } finally {
    loading.value = false
  }
}

async function createReport(name: string): Promise<void> {
  if (!selectedProjectId.value || saving.value) {
    return
  }

  saving.value = true
  try {
    const created = await reportService.createReport({
      projectId: selectedProjectId.value,
      name,
    })

    await loadReports(selectedProjectId.value)
    selectedReportId.value = created.id
    await loadReportDetails(created.id)
    setMessage('Report created.')
  } catch {
    setMessage('Failed to create report.')
  } finally {
    saving.value = false
  }
}

function nextOrderIndex(): number {
  if (layoutItems.value.length === 0) {
    return 0
  }

  return Math.max(...layoutItems.value.map((item) => item.orderIndex)) + 1
}

async function addChart(chartId: string): Promise<void> {
  if (!selectedReportId.value || saving.value) {
    return
  }

  if (layoutItems.value.some((item) => item.chartId === chartId)) {
    setMessage('Chart is already part of this report.')
    return
  }

  saving.value = true

  try {
    const chartLink = await reportService.addChartToReport({
      reportId: selectedReportId.value,
      chartId,
      orderIndex: nextOrderIndex(),
    })

    const fallback = availableCharts.value.find((item) => item.id === chartId)
    layoutItems.value = [
      ...layoutItems.value,
      {
        id: chartLink.id,
        chartId: chartLink.chartId,
        chartName: fallback?.name ?? chartLink.chartName,
        orderIndex: chartLink.orderIndex,
        chart: await getRenderableChart(chartLink.chartId),
      },
    ]

    layoutItems.value.sort((left, right) => left.orderIndex - right.orderIndex)
    setMessage('Chart added to report.')
  } catch {
    setMessage('Failed to add chart to report.')
  } finally {
    saving.value = false
  }
}

function startReportChartDrag(chartId: string, event: DragEvent): void {
  if (!selectedReportId.value || !chartId || !event.dataTransfer) {
    return
  }

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-chart-id', chartId)
}

async function handleReportDrop(event: DragEvent): Promise<void> {
  event.preventDefault()

  const chartId = event.dataTransfer?.getData('application/x-chart-id')
  if (!chartId) {
    return
  }

  await addChart(chartId)
}

async function persistOrder(nextItems: ReportLayoutItem[]): Promise<void> {
  const indexedNext = nextItems.map((item, index) => ({
    ...item,
    targetIndex: index,
  }))

  const changed = indexedNext.filter((item) => item.orderIndex !== item.targetIndex)
  if (changed.length === 0) {
    layoutItems.value = indexedNext.map(({ targetIndex, ...item }) => ({
      ...item,
      orderIndex: targetIndex,
    }))
    return
  }

  const maxCurrentOrder = Math.max(...layoutItems.value.map((item) => item.orderIndex), 0)
  const tempBase = maxCurrentOrder + layoutItems.value.length + 10

  for (let index = 0; index < changed.length; index += 1) {
    await reportService.reorderReportChart({
      id: changed[index].id,
      orderIndex: tempBase + index,
    })
  }

  for (const item of changed) {
    await reportService.reorderReportChart({
      id: item.id,
      orderIndex: item.targetIndex,
    })
  }

  layoutItems.value = indexedNext
    .map(({ targetIndex, ...item }) => ({
      ...item,
      orderIndex: targetIndex,
    }))
    .sort((left, right) => left.orderIndex - right.orderIndex)
}

async function moveChart(reportChartId: string, direction: -1 | 1): Promise<void> {
  if (saving.value) {
    return
  }

  const current = [...sortedLayoutItems.value]
  const sourceIndex = current.findIndex((item) => item.id === reportChartId)
  const targetIndex = sourceIndex + direction

  if (sourceIndex < 0 || targetIndex < 0 || targetIndex >= current.length) {
    return
  }

  saving.value = true
  try {
    const [moved] = current.splice(sourceIndex, 1)
    current.splice(targetIndex, 0, moved)

    await persistOrder(current)
    setMessage('Chart order updated.')
  } catch {
    setMessage('Failed to reorder charts.')
    await loadReportDetails(selectedReportId.value)
  } finally {
    saving.value = false
  }
}

async function removeChart(reportChartId: string): Promise<void> {
  if (saving.value) {
    return
  }

  saving.value = true
  try {
    await reportService.removeReportChart(reportChartId)
    layoutItems.value = layoutItems.value.filter((item) => item.id !== reportChartId)
    setMessage('Chart removed from report.')
  } catch {
    setMessage('Failed to remove chart from report.')
  } finally {
    saving.value = false
  }
}

watch(selectedProjectId, async (projectId) => {
  const selectedProject = projects.value.find((project) => project.id === projectId)
  if (selectedProject) {
    projectStore.setCurrentProject({ id: selectedProject.id, name: selectedProject.name })
  }

  await Promise.all([loadCharts(projectId), loadReports(projectId)])
})

watch(selectedReportId, async (reportId) => {
  await loadReportDetails(reportId)
})

onMounted(async () => {
  await loadProjects()

  if (selectedProjectId.value) {
    await Promise.all([loadCharts(selectedProjectId.value), loadReports(selectedProjectId.value)])
  }

  if (selectedReportId.value) {
    await loadReportDetails(selectedReportId.value)
  }
})
</script>

<template>
  <main class="report-builder-page">
    <header class="topbar">
      <ReportSelectionBar
        :projects="projects"
        :reports="reports"
        :selected-project-id="selectedProjectId"
        :selected-report-id="selectedReportId"
        :loading="loading || saving"
        @update:selected-project-id="selectedProjectId = $event"
        @update:selected-report-id="selectedReportId = $event"
        @create-report="createReport"
      />
    </header>

    <p v-if="message" class="message">{{ message }}</p>

    <section class="content-grid">
      <aside class="chart-picker">
        <h2>Project Charts</h2>
        <p class="hint">Select a chart to add it to the report.</p>

        <button
          v-for="chart in availableCharts"
          :key="chart.id"
          class="chart-item chart-card"
          :disabled="saving || !selectedReportId"
          draggable="true"
          @dragstart="startReportChartDrag(chart.id, $event)"
          @click="addChart(chart.id)"
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

      <section class="report-preview" @dragover.prevent @drop="handleReportDrop">
        <div class="pdf-surface">
          <ReportChartLayout
            :items="sortedLayoutItems"
            :loading="loading"
            @move-up="moveChart($event, -1)"
            @move-down="moveChart($event, 1)"
            @remove="removeChart"
          />
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.report-builder-page {
  height: calc(100vh - var(--nav-height));
  overflow: auto;
  padding: 16px;
  background: #f8fafc;
}

.topbar {
  margin-bottom: 10px;
}

.message {
  color: #0f766e;
  font-size: 13px;
  margin: 0 0 10px;
}

.content-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 14px;
}

.chart-picker,
.report-preview {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
}

.chart-picker {
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
  cursor: pointer;
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

.chart-item[draggable='true'] {
  cursor: grab;
}

.chart-item[draggable='true']:active {
  cursor: grabbing;
}

.chart-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chart-item small {
  color: #64748b;
}

.report-preview {
  overflow: auto;
}

.pdf-surface {
  width: min(100%, 900px);
  margin: 0 auto;
  padding: 14px;
}

.hint {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}
</style>
