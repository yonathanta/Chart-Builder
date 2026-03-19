<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import DashboardSelectionBar from '../components/dashboard-builder/DashboardSelectionBar.vue'
import DashboardLayoutGrid, {
  type DashboardCanvasItem,
  type DashboardWidgetKind,
} from '../components/dashboard-builder/DashboardLayoutGrid.vue'
import ChartRenderer from '../components/ChartRenderer.vue'
import dashboardService, { type DashboardChartLayout, type DashboardRecord } from '../services/dashboardService'
import projectService, { type ProjectRecord } from '../services/projectService'
import chartService from '../services/chartService'
import datasetService, { type DatasetRecord } from '../services/datasetService'
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
  configuration?: string
  Configuration?: string
  datasetId?: string
  DatasetId?: string
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

type DashboardPageState = {
  id: string
  name: string
  items: DashboardCanvasItem[]
}

type StudioSnapshot = {
  pages: DashboardPageState[]
  selectedPageId: string
  canvasMode: 'responsive' | 'a4'
  showGrid: boolean
  snapToGrid: boolean
  zoomPercent: number
  selectedDatasetId: string
  filters: {
    country: string
    year: string
    indicator: string
  }
}

const projectStore = useProjectStore()
const responsiveStore = useResponsiveStore()

const projects = ref<ProjectRecord[]>([])
const dashboards = ref<DashboardRecord[]>([])
const availableCharts = ref<ProjectChartOption[]>([])
const datasets = ref<DatasetRecord[]>([])

const selectedProjectId = ref('')
const selectedDashboardId = ref('')
const selectedDatasetId = ref('')

const loading = ref(false)
const saving = ref(false)
const message = ref('')

const canvasMode = ref<'responsive' | 'a4'>('responsive')
const showGrid = ref(true)
const snapToGrid = ref(true)
const zoomPercent = ref(100)

const pages = ref<DashboardPageState[]>([])
const selectedPageId = ref('')
const selectedWidgetId = ref<string | null>(null)

const countryFilter = ref('')
const yearFilter = ref('')
const indicatorFilter = ref('')

const dataRows = ref<Array<Record<string, unknown>>>([])
const countryField = ref('country')
const yearField = ref('year')
const indicatorField = ref('indicator')
const kpiField = ref('')

const canvasCaptureRef = ref<HTMLElement | null>(null)
const importInputRef = ref<HTMLInputElement | null>(null)

const undoStack = ref<string[]>([])
const redoStack = ref<string[]>([])
let persistTimer: number | null = null

const componentPalette: Array<{ kind: DashboardWidgetKind; label: string; icon: string }> = [
  { kind: 'title', label: 'Title', icon: 'T' },
  { kind: 'subtitle', label: 'Subtitle', icon: 'ST' },
  { kind: 'paragraph', label: 'Paragraph', icon: 'P' },
  { kind: 'kpi', label: 'KPI', icon: 'KPI' },
  { kind: 'table', label: 'Table', icon: 'TB' },
  { kind: 'image', label: 'Image', icon: 'IMG' },
  { kind: 'icon', label: 'Icon', icon: '★' },
]

const activePage = computed(() => {
  const found = pages.value.find((page) => page.id === selectedPageId.value)
  if (found) return found
  return pages.value[0] ?? null
})

const selectedWidget = computed(() => {
  const page = activePage.value
  if (!page || !selectedWidgetId.value) return null
  return page.items.find((item) => item.id === selectedWidgetId.value) ?? null
})

const isTextWidgetSelected = computed(() => {
  return selectedWidget.value?.kind === 'title'
    || selectedWidget.value?.kind === 'subtitle'
    || selectedWidget.value?.kind === 'paragraph'
})

const chartWidgets = computed(() => {
  const page = activePage.value
  if (!page) return []
  return page.items.filter((item) => item.kind === 'chart')
})

const countryOptions = computed(() => {
  if (!countryField.value) return []
  const values = new Set<string>()
  for (const row of dataRows.value) {
    const value = row[countryField.value]
    if (value !== undefined && value !== null && String(value).trim()) {
      values.add(String(value))
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right))
})

const yearOptions = computed(() => {
  if (!yearField.value) return []
  const values = new Set<string>()
  for (const row of dataRows.value) {
    const value = row[yearField.value]
    if (value !== undefined && value !== null && String(value).trim()) {
      values.add(String(value))
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right))
})

const indicatorOptions = computed(() => {
  if (!indicatorField.value) return []
  const values = new Set<string>()
  for (const row of dataRows.value) {
    const value = row[indicatorField.value]
    if (value !== undefined && value !== null && String(value).trim()) {
      values.add(String(value))
    }
  }
  return Array.from(values).sort((left, right) => left.localeCompare(right))
})

const numericFields = computed(() => {
  if (dataRows.value.length === 0) return []
  const candidates = Object.keys(dataRows.value[0] ?? {})
  return candidates.filter((field) =>
    dataRows.value.some((row) => Number.isFinite(Number(row[field])))
  )
})

const filteredRows = computed(() => {
  return dataRows.value.filter((row) => {
    if (countryFilter.value && String(row[countryField.value] ?? '') !== countryFilter.value) return false
    if (yearFilter.value && String(row[yearField.value] ?? '') !== yearFilter.value) return false
    if (indicatorFilter.value && String(row[indicatorField.value] ?? '') !== indicatorFilter.value) return false
    return true
  })
})

const renderItems = computed<DashboardCanvasItem[]>(() => {
  const page = activePage.value
  if (!page) return []

  return page.items.map((item) => {
    if (item.kind !== 'chart' || !item.chart) {
      return item
    }

    return {
      ...item,
      chart: {
        ...item.chart,
        dataset: filteredRows.value.length > 0 ? filteredRows.value : item.chart.dataset,
      },
    }
  })
})

function setMessage(text: string): void {
  message.value = text
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
    }
  }, 2600)
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

function makeId(): string {
  return crypto.randomUUID()
}

function defaultPage(name = 'Page 1'): DashboardPageState {
  return {
    id: makeId(),
    name,
    items: [],
  }
}

function studioStorageKey(): string {
  return `dashboard-studio:${selectedDashboardId.value || 'none'}`
}

function snapshot(): StudioSnapshot {
  return {
    pages: pages.value,
    selectedPageId: selectedPageId.value,
    canvasMode: canvasMode.value,
    showGrid: showGrid.value,
    snapToGrid: snapToGrid.value,
    zoomPercent: zoomPercent.value,
    selectedDatasetId: selectedDatasetId.value,
    filters: {
      country: countryFilter.value,
      year: yearFilter.value,
      indicator: indicatorFilter.value,
    },
  }
}

function applySnapshot(next: StudioSnapshot): void {
  pages.value = next.pages
  selectedPageId.value = next.selectedPageId
  canvasMode.value = next.canvasMode
  showGrid.value = next.showGrid
  snapToGrid.value = next.snapToGrid
  zoomPercent.value = next.zoomPercent
  selectedDatasetId.value = next.selectedDatasetId
  countryFilter.value = next.filters.country
  yearFilter.value = next.filters.year
  indicatorFilter.value = next.filters.indicator
}

function pushHistory(): void {
  undoStack.value.push(JSON.stringify(snapshot()))
  if (undoStack.value.length > 80) {
    undoStack.value.shift()
  }
  redoStack.value = []
}

function commitMutation(mutator: () => void): void {
  pushHistory()
  mutator()
  schedulePersistStudio()
}

function undo(): void {
  const prev = undoStack.value.pop()
  if (!prev) return

  redoStack.value.push(JSON.stringify(snapshot()))
  applySnapshot(JSON.parse(prev) as StudioSnapshot)
  persistStudioToLocal()
}

function redo(): void {
  const next = redoStack.value.pop()
  if (!next) return

  undoStack.value.push(JSON.stringify(snapshot()))
  applySnapshot(JSON.parse(next) as StudioSnapshot)
  persistStudioToLocal()
}

function schedulePersistStudio(): void {
  if (persistTimer !== null) {
    window.clearTimeout(persistTimer)
  }

  persistTimer = window.setTimeout(() => {
    persistStudioToLocal()
  }, 180)
}

function persistStudioToLocal(): void {
  if (!selectedDashboardId.value) return
  localStorage.setItem(studioStorageKey(), JSON.stringify(snapshot()))
}

function loadStudioFromLocal(): boolean {
  if (!selectedDashboardId.value) return false

  try {
    const raw = localStorage.getItem(studioStorageKey())
    if (!raw) return false

    const parsed = JSON.parse(raw) as StudioSnapshot
    if (!Array.isArray(parsed.pages) || parsed.pages.length === 0) {
      return false
    }

    applySnapshot(parsed)
    return true
  } catch {
    return false
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

  return parsed
}

async function resolveDatasetById(datasetId: string): Promise<unknown> {
  try {
    const dataset = await datasetService.getDataset(datasetId)
    const parsed = parseJson(dataset.dataJson)
    if (Array.isArray(parsed)) return parsed
    if (parsed && typeof parsed === 'object') {
      const wrapped = (parsed as { data?: unknown }).data
      if (Array.isArray(wrapped)) return wrapped
    }
    return []
  } catch {
    return []
  }
}

function detectField(candidateRows: Array<Record<string, unknown>>, preferred: string[]): string {
  if (candidateRows.length === 0) return ''
  const keys = Object.keys(candidateRows[0] ?? {})

  for (const pref of preferred) {
    const hit = keys.find((key) => key.toLowerCase().includes(pref.toLowerCase()))
    if (hit) return hit
  }

  return keys[0] ?? ''
}

async function loadProjects(): Promise<void> {
  loading.value = true
  try {
    projects.value = await projectService.getProjects()

    if (projectStore.currentProject?.id) {
      selectedProjectId.value = projectStore.currentProject.id
    } else if (projects.value.length > 0) {
      selectedProjectId.value = projects.value[0]?.id ?? ''
    }
  } catch {
    setMessage('Failed to load projects.')
  } finally {
    loading.value = false
  }
}

async function loadDashboards(projectId: string): Promise<void> {
  if (!projectId) {
    dashboards.value = []
    selectedDashboardId.value = ''
    pages.value = [defaultPage()]
    selectedPageId.value = pages.value[0]?.id ?? ''
    return
  }

  loading.value = true
  try {
    dashboards.value = await dashboardService.getDashboardsByProject(projectId)
    selectedDashboardId.value = dashboards.value[0]?.id ?? ''
  } catch {
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

    availableCharts.value = await Promise.all(
      response.map(async (item) => {
        const chart = item as ApiChart
        const chartId = String(chart.id ?? chart.Id ?? '')
        const chartName = String(chart.name ?? chart.Name ?? 'Untitled chart')
        const chartType = String(chart.chartType ?? chart.ChartType ?? 'bar')
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
  } catch {
    availableCharts.value = []
  }
}

async function loadDatasets(projectId: string): Promise<void> {
  if (!projectId) {
    datasets.value = []
    dataRows.value = []
    selectedDatasetId.value = ''
    return
  }

  try {
    datasets.value = await datasetService.getDatasetsByProject(projectId)
    selectedDatasetId.value = datasets.value[0]?.id ?? ''
  } catch {
    datasets.value = []
    dataRows.value = []
    selectedDatasetId.value = ''
  }
}

async function loadSelectedDataset(datasetId: string): Promise<void> {
  if (!datasetId) {
    dataRows.value = []
    return
  }

  try {
    const dataset = await datasetService.getDataset(datasetId)
    const parsed = parseJson(dataset.dataJson)
    if (Array.isArray(parsed)) {
      dataRows.value = parsed as Array<Record<string, unknown>>
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { data?: unknown }).data)) {
      dataRows.value = (parsed as { data?: Array<Record<string, unknown>> }).data ?? []
    } else {
      dataRows.value = []
    }

    countryField.value = detectField(dataRows.value, ['country', 'nation', 'region'])
    yearField.value = detectField(dataRows.value, ['year', 'period'])
    indicatorField.value = detectField(dataRows.value, ['indicator', 'category', 'series'])

    if (!kpiField.value || !numericFields.value.includes(kpiField.value)) {
      kpiField.value = numericFields.value[0] ?? ''
    }
  } catch {
    dataRows.value = []
  }
}

async function hydrateDashboardCharts(layouts: DashboardChartLayout[]): Promise<DashboardCanvasItem[]> {
  const widgets = await Promise.all(
    layouts.map(async (layout) => {
      let chartPayload: DashboardCanvasItem['chart'] = null

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
      } catch {
        chartPayload = null
      }

      return {
        id: makeId(),
        layoutId: layout.id,
        kind: 'chart',
        title: layout.chartName,
        chartId: layout.chartId,
        x: layout.positionX,
        y: layout.positionY,
        w: layout.width,
        h: layout.height,
        chart: chartPayload,
        metadata: {},
      } satisfies DashboardCanvasItem
    })
  )

  return widgets
}

async function loadDashboardDetails(dashboardId: string): Promise<void> {
  if (!dashboardId) {
    pages.value = [defaultPage()]
    selectedPageId.value = pages.value[0]?.id ?? ''
    return
  }

  loading.value = true
  try {
    const details = await dashboardService.getDashboard(dashboardId)
    const chartWidgets = await hydrateDashboardCharts(details.charts)

    pages.value = [{
      id: makeId(),
      name: 'Page 1',
      items: chartWidgets,
    }]
    selectedPageId.value = pages.value[0]?.id ?? ''

    if (!loadStudioFromLocal()) {
      persistStudioToLocal()
    }
  } catch {
    pages.value = [defaultPage()]
    selectedPageId.value = pages.value[0]?.id ?? ''
    setMessage('Failed to load dashboard details.')
  } finally {
    loading.value = false
  }
}

async function syncActivePageChartsToApi(): Promise<void> {
  if (saving.value || !selectedDashboardId.value || !activePage.value) {
    return
  }

  const chartItems = activePage.value.items.filter((item) => item.kind === 'chart' && item.chartId)
  if (chartItems.length === 0) {
    setMessage('No chart widgets to sync.')
    return
  }

  saving.value = true
  try {
    for (const item of chartItems) {
      if (item.layoutId) {
        await dashboardService.updateChartLayout({
          id: item.layoutId,
          positionX: item.x,
          positionY: item.y,
          width: item.w,
          height: item.h,
        })
        continue
      }

      const created = await dashboardService.addChartToDashboard({
        dashboardId: selectedDashboardId.value,
        chartId: item.chartId as string,
        positionX: item.x,
        positionY: item.y,
        width: item.w,
        height: item.h,
      })

      item.layoutId = created.id
    }

    setMessage('Chart layouts synced to API.')
  } catch {
    setMessage('Failed to sync chart widgets to API.')
  } finally {
    saving.value = false
  }
}

function startProjectChartDrag(chartId: string, event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-chart-id', chartId)
}

function startComponentDrag(kind: DashboardWidgetKind, event: DragEvent): void {
  if (!event.dataTransfer) return
  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-widget-kind', kind)
}

function createWidget(kind: DashboardWidgetKind, x: number, y: number): DashboardCanvasItem {
  const base: DashboardCanvasItem = {
    id: makeId(),
    kind,
    title: kind.charAt(0).toUpperCase() + kind.slice(1),
    x,
    y,
    w: kind === 'title' ? 8 : kind === 'subtitle' ? 7 : kind === 'paragraph' ? 6 : kind === 'table' ? 6 : kind === 'kpi' ? 3 : kind === 'image' ? 5 : kind === 'icon' ? 2 : 4,
    h: kind === 'title' ? 3 : kind === 'subtitle' ? 3 : kind === 'paragraph' ? 6 : kind === 'table' ? 6 : kind === 'kpi' ? 4 : kind === 'image' ? 6 : kind === 'icon' ? 3 : 4,
    text: kind === 'title' ? 'Dashboard Title' : kind === 'subtitle' ? 'Subtitle' : kind === 'paragraph' ? 'Write your narrative here.' : undefined,
    icon: kind === 'icon' ? '★' : undefined,
    metadata: {
      source: '',
      note: '',
    },
    style: {
      fontSize: kind === 'title' ? 32 : kind === 'subtitle' ? 22 : 14,
      fontWeight: kind === 'title' || kind === 'subtitle' ? 'bold' : 'normal',
      textAlign: 'left',
    },
    binding: kind === 'kpi' ? { field: kpiField.value || numericFields.value[0] || '' } : undefined,
  }

  return base
}

function createChartWidget(chartId: string, x: number, y: number): DashboardCanvasItem | null {
  const chart = availableCharts.value.find((candidate) => candidate.id === chartId)
  if (!chart) return null

  return {
    id: makeId(),
    kind: 'chart',
    title: chart.name,
    chartId: chart.id,
    x,
    y,
    w: 4,
    h: 4,
    chart: chart.previewChart,
    metadata: {
      source: '',
      note: '',
    },
  }
}

function addWidgetToActivePage(widget: DashboardCanvasItem): void {
  const page = activePage.value
  if (!page) return

  commitMutation(() => {
    page.items = [...page.items, widget]
    selectedWidgetId.value = widget.id
  })
}

function handleAddWidget(payload: { kind: DashboardWidgetKind; chartId?: string; x: number; y: number }): void {
  if (payload.kind === 'chart' && payload.chartId) {
    const widget = createChartWidget(payload.chartId, payload.x, payload.y)
    if (!widget) {
      setMessage('Unable to add chart to canvas.')
      return
    }
    addWidgetToActivePage(widget)
    return
  }

  addWidgetToActivePage(createWidget(payload.kind, payload.x, payload.y))
}

function handleCanvasUpdateItem(payload: { id: string; patch: Partial<DashboardCanvasItem> }): void {
  const page = activePage.value
  if (!page) return

  const patchKeys = Object.keys(payload.patch)
  const isLayoutOnly = patchKeys.length > 0 && patchKeys.every((key) => ['x', 'y', 'w', 'h'].includes(key))

  const applyPatch = () => {
    page.items = page.items.map((item) =>
      item.id === payload.id
        ? {
            ...item,
            ...payload.patch,
            style: {
              ...(item.style ?? {}),
              ...((payload.patch.style as DashboardCanvasItem['style']) ?? {}),
            },
            metadata: {
              ...(item.metadata ?? {}),
              ...((payload.patch.metadata as DashboardCanvasItem['metadata']) ?? {}),
            },
            binding: {
              ...(item.binding ?? {}),
              ...((payload.patch.binding as DashboardCanvasItem['binding']) ?? {}),
            },
          }
        : item
    )
  }

  if (isLayoutOnly) {
    applyPatch()
    schedulePersistStudio()
    return
  }

  commitMutation(applyPatch)
}

function handleRemoveWidget(payload: { id: string }): void {
  const page = activePage.value
  if (!page) return

  commitMutation(() => {
    page.items = page.items.filter((item) => item.id !== payload.id)
    if (selectedWidgetId.value === payload.id) {
      selectedWidgetId.value = null
    }
  })
}

function applyTextStyle(patch: Partial<NonNullable<DashboardCanvasItem['style']>>): void {
  const widget = selectedWidget.value
  if (!widget || !isTextWidgetSelected.value) return

  handleCanvasUpdateItem({
    id: widget.id,
    patch: {
      style: {
        ...(widget.style ?? {}),
        ...patch,
      },
    },
  })
}

function addPage(): void {
  commitMutation(() => {
    const next = defaultPage(`Page ${pages.value.length + 1}`)
    pages.value = [...pages.value, next]
    selectedPageId.value = next.id
  })
}

function removeCurrentPage(): void {
  if (pages.value.length <= 1 || !activePage.value) return

  commitMutation(() => {
    pages.value = pages.value.filter((page) => page.id !== activePage.value?.id)
    selectedPageId.value = pages.value[0]?.id ?? ''
  })
}

async function exportPng(): Promise<void> {
  const target = canvasCaptureRef.value
  if (!target) return

  try {
    const { default: html2canvas } = await import('html2canvas')
    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
    })

    const link = document.createElement('a')
    link.download = `dashboard-${selectedDashboardId.value || 'export'}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  } catch {
    setMessage('PNG export failed.')
  }
}

async function exportPdf(): Promise<void> {
  const target = canvasCaptureRef.value
  if (!target) return

  try {
    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ])

    const canvas = await html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: 2,
    })

    const image = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()

    const ratio = Math.min(pageW / canvas.width, pageH / canvas.height)
    const drawW = canvas.width * ratio
    const drawH = canvas.height * ratio
    const offsetX = (pageW - drawW) / 2
    const offsetY = (pageH - drawH) / 2

    pdf.addImage(image, 'PNG', offsetX, offsetY, drawW, drawH)
    pdf.save(`dashboard-${selectedDashboardId.value || 'export'}.pdf`)
  } catch {
    setMessage('PDF export failed.')
  }
}

function saveLayoutJson(): void {
  const content = JSON.stringify(snapshot(), null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `dashboard-layout-${selectedDashboardId.value || 'studio'}.json`
  link.click()
  URL.revokeObjectURL(url)
}

function triggerLoadLayoutJson(): void {
  importInputRef.value?.click()
}

async function onLoadLayoutJson(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  try {
    const text = await file.text()
    const parsed = JSON.parse(text) as StudioSnapshot
    applySnapshot(parsed)
    persistStudioToLocal()
    setMessage('Layout JSON loaded.')
  } catch {
    setMessage('Invalid layout JSON file.')
  } finally {
    input.value = ''
  }
}

function startKpiBinding(): void {
  const widget = selectedWidget.value
  if (!widget || widget.kind !== 'kpi') return

  handleCanvasUpdateItem({
    id: widget.id,
    patch: {
      binding: {
        field: kpiField.value,
      },
    },
  })
}

watch(selectedProjectId, async (projectId) => {
  const selectedProject = projects.value.find((project) => project.id === projectId)
  if (selectedProject) {
    projectStore.setCurrentProject({ id: selectedProject.id, name: selectedProject.name })
  }

  await Promise.all([loadDashboards(projectId), loadCharts(projectId), loadDatasets(projectId)])
})

watch(selectedDashboardId, async (dashboardId) => {
  undoStack.value = []
  redoStack.value = []
  selectedWidgetId.value = null
  await loadDashboardDetails(dashboardId)
})

watch(selectedDatasetId, async (datasetId) => {
  await loadSelectedDataset(datasetId)
  schedulePersistStudio()
})

watch([canvasMode, showGrid, snapToGrid, zoomPercent, countryFilter, yearFilter, indicatorFilter], () => {
  schedulePersistStudio()
})

onMounted(async () => {
  await loadProjects()

  if (selectedProjectId.value) {
    await Promise.all([
      loadDashboards(selectedProjectId.value),
      loadCharts(selectedProjectId.value),
      loadDatasets(selectedProjectId.value),
    ])
  }

  if (selectedDashboardId.value) {
    await loadDashboardDetails(selectedDashboardId.value)
  }

  if (selectedDatasetId.value) {
    await loadSelectedDataset(selectedDatasetId.value)
  }
})
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

      <div class="toolbar">
        <button class="tool-btn" :disabled="undoStack.length === 0" @click="undo">Undo</button>
        <button class="tool-btn" :disabled="redoStack.length === 0" @click="redo">Redo</button>

        <select v-model="canvasMode" class="tool-select">
          <option value="responsive">Responsive Screen</option>
          <option value="a4">A4 Fixed</option>
        </select>

        <label class="tool-check">
          <input v-model="showGrid" type="checkbox" />
          Grid
        </label>

        <label class="tool-check">
          <input v-model="snapToGrid" type="checkbox" />
          Snap
        </label>

        <label class="zoom-wrap">
          Zoom
          <input v-model.number="zoomPercent" type="range" min="50" max="200" step="5" />
          <span>{{ zoomPercent }}%</span>
        </label>

        <button class="tool-btn" @click="exportPng">PNG</button>
        <button class="tool-btn" @click="exportPdf">PDF</button>
        <button class="tool-btn" @click="saveLayoutJson">Save JSON</button>
        <button class="tool-btn" @click="triggerLoadLayoutJson">Load JSON</button>
        <button class="tool-btn" :disabled="saving || !selectedDashboardId" @click="syncActivePageChartsToApi">
          {{ saving ? 'Syncing...' : 'Sync Charts API' }}
        </button>
      </div>
    </header>

    <input ref="importInputRef" class="hidden-input" type="file" accept="application/json" @change="onLoadLayoutJson" />

    <section class="filters-bar">
      <select v-model="selectedDatasetId" class="tool-select">
        <option value="">Select Dataset</option>
        <option v-for="dataset in datasets" :key="dataset.id" :value="dataset.id">{{ dataset.name }}</option>
      </select>

      <select v-model="countryFilter" class="tool-select">
        <option value="">All Countries</option>
        <option v-for="item in countryOptions" :key="`country-${item}`" :value="item">{{ item }}</option>
      </select>

      <select v-model="yearFilter" class="tool-select">
        <option value="">All Years</option>
        <option v-for="item in yearOptions" :key="`year-${item}`" :value="item">{{ item }}</option>
      </select>

      <select v-model="indicatorFilter" class="tool-select">
        <option value="">All Indicators</option>
        <option v-for="item in indicatorOptions" :key="`indicator-${item}`" :value="item">{{ item }}</option>
      </select>
    </section>

    <p v-if="message" class="message">{{ message }}</p>
    <p v-if="loading" class="hint">Loading dashboard studio...</p>

    <section v-if="!loading" class="studio-grid">
      <aside class="left-panel">
        <h2>Components</h2>
        <div class="component-row">
          <button
            v-for="component in componentPalette"
            :key="component.kind"
            class="component-btn"
            type="button"
            :title="component.label"
            draggable="true"
            @dragstart="startComponentDrag(component.kind, $event)"
            @click="handleAddWidget({ kind: component.kind, x: 0, y: renderItems.length * 2 + 1 })"
          >
            <span>{{ component.icon }}</span>
          </button>
        </div>

        <h3>Charts</h3>
        <button
          v-for="chart in availableCharts"
          :key="chart.id"
          class="chart-item"
          type="button"
          :title="chart.name"
          draggable="true"
          @dragstart="startProjectChartDrag(chart.id, $event)"
          @click="handleAddWidget({ kind: 'chart', chartId: chart.id, x: 0, y: renderItems.length * 2 + 1 })"
        >
          <div class="chart-item__title">{{ chart.name }}</div>
          <small>{{ chart.chartType }}</small>
          <div class="chart-thumb">
            <ChartRenderer v-if="chart.previewChart" :chart="chart.previewChart" />
          </div>
        </button>
      </aside>

      <section class="canvas-panel" ref="canvasCaptureRef">
        <DashboardLayoutGrid
          :items="renderItems"
          :selected-id="selectedWidgetId"
          :device-type="responsiveStore.deviceType"
          :canvas-mode="canvasMode"
          :show-grid="showGrid"
          :snap-to-grid="snapToGrid"
          :zoom-percent="zoomPercent"
          :dataset-rows="filteredRows"
          @add-widget="handleAddWidget"
          @update-item="handleCanvasUpdateItem"
          @select="selectedWidgetId = $event.id"
          @remove="handleRemoveWidget"
        />
      </section>

      <aside class="right-panel">
        <h2>Inspector</h2>
        <p v-if="!selectedWidget" class="hint">Select an element on canvas.</p>

        <template v-else>
          <label class="field">
            <span>Name</span>
            <input
              class="text-input"
              :value="selectedWidget.title"
              @input="handleCanvasUpdateItem({ id: selectedWidget.id, patch: { title: ($event.target as HTMLInputElement).value } })"
            />
          </label>

          <label class="field">
            <span>Source</span>
            <input
              class="text-input"
              :value="selectedWidget.metadata?.source ?? ''"
              @input="handleCanvasUpdateItem({ id: selectedWidget.id, patch: { metadata: { ...(selectedWidget.metadata ?? {}), source: ($event.target as HTMLInputElement).value } } })"
            />
          </label>

          <label class="field">
            <span>Note</span>
            <textarea
              class="text-input"
              rows="3"
              :value="selectedWidget.metadata?.note ?? ''"
              @input="handleCanvasUpdateItem({ id: selectedWidget.id, patch: { metadata: { ...(selectedWidget.metadata ?? {}), note: ($event.target as HTMLTextAreaElement).value } } })"
            ></textarea>
          </label>

          <template v-if="isTextWidgetSelected">
            <label class="field">
              <span>Font Size</span>
              <input
                class="text-input"
                type="number"
                min="10"
                max="72"
                :value="selectedWidget.style?.fontSize ?? 14"
                @input="applyTextStyle({ fontSize: Number(($event.target as HTMLInputElement).value) })"
              />
            </label>

            <div class="inline-tools">
              <button class="tool-btn" @click="applyTextStyle({ fontWeight: selectedWidget.style?.fontWeight === 'bold' ? 'normal' : 'bold' })">
                Bold
              </button>
              <button class="tool-btn" @click="applyTextStyle({ textAlign: 'left' })">Left</button>
              <button class="tool-btn" @click="applyTextStyle({ textAlign: 'center' })">Center</button>
              <button class="tool-btn" @click="applyTextStyle({ textAlign: 'right' })">Right</button>
            </div>
          </template>

          <template v-if="selectedWidget.kind === 'kpi'">
            <label class="field">
              <span>KPI Field</span>
              <select v-model="kpiField" class="tool-select" @change="startKpiBinding">
                <option value="">Select metric</option>
                <option v-for="field in numericFields" :key="`metric-${field}`" :value="field">{{ field }}</option>
              </select>
            </label>
          </template>
        </template>
      </aside>
    </section>

    <footer v-if="!loading" class="pages-bar">
      <div class="page-tabs">
        <button
          v-for="page in pages"
          :key="page.id"
          class="page-tab"
          :class="{ 'page-tab--active': page.id === selectedPageId }"
          @click="selectedPageId = page.id"
        >
          {{ page.name }}
        </button>
      </div>

      <div class="pages-actions">
        <button class="tool-btn" @click="addPage">Add Page</button>
        <button class="tool-btn" :disabled="pages.length <= 1" @click="removeCurrentPage">Remove Page</button>
      </div>
    </footer>
  </main>
</template>

<style scoped>
.dashboard-builder-page {
  min-height: calc(100vh - var(--nav-height));
  padding: 14px;
  background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topbar {
  display: grid;
  gap: 10px;
}

.toolbar {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.filters-bar {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
  display: grid;
  grid-template-columns: repeat(4, minmax(150px, 1fr));
  gap: 8px;
}

.tool-btn,
.tool-select,
.text-input {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  padding: 8px 10px;
  font-size: 13px;
}

.tool-btn {
  cursor: pointer;
}

.tool-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.tool-check {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #334155;
}

.zoom-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #334155;
}

.hidden-input {
  display: none;
}

.studio-grid {
  display: grid;
  grid-template-columns: 300px 1fr 280px;
  gap: 10px;
  min-height: 760px;
}

.left-panel,
.right-panel,
.canvas-panel {
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #ffffff;
  padding: 10px;
}

.left-panel,
.right-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 74vh;
  overflow: auto;
}

.left-panel h2,
.right-panel h2 {
  margin: 0;
  font-size: 16px;
}

.left-panel h3 {
  margin: 8px 0 0;
  font-size: 13px;
  color: #475569;
}

.component-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.component-btn {
  height: 40px;
  border: 1px solid #cbd5e1;
  border-radius: 10px;
  background: #ffffff;
  cursor: grab;
}

.component-btn:active {
  cursor: grabbing;
}

.chart-item {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #ffffff;
  padding: 8px;
  text-align: left;
  cursor: grab;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.chart-item__title {
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.chart-item small {
  font-size: 11px;
  color: #64748b;
}

.chart-thumb {
  height: 100px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  overflow: hidden;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field span {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}

.inline-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.pages-bar {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #ffffff;
  padding: 8px;
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.page-tabs {
  display: flex;
  gap: 6px;
  overflow: auto;
}

.page-tab {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #f8fafc;
  padding: 7px 10px;
  cursor: pointer;
  font-size: 12px;
}

.page-tab--active {
  border-color: #2563eb;
  background: #2563eb;
  color: #ffffff;
}

.pages-actions {
  display: flex;
  gap: 6px;
}

.message {
  color: #0f766e;
  font-size: 13px;
  margin: 0;
}

.hint {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

@media (max-width: 1200px) {
  .studio-grid {
    grid-template-columns: 260px 1fr;
  }

  .right-panel {
    grid-column: 1 / -1;
    max-height: none;
  }
}

@media (max-width: 900px) {
  .studio-grid {
    grid-template-columns: 1fr;
  }

  .filters-bar {
    grid-template-columns: 1fr 1fr;
  }
}

@media (max-width: 640px) {
  .dashboard-builder-page {
    padding: 8px;
  }

  .filters-bar {
    grid-template-columns: 1fr;
  }

  .component-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
</style>
