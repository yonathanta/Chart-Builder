<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import ReportSelectionBar from '../components/report-builder/ReportSelectionBar.vue'
import ChartRenderer from '../components/ChartRenderer.vue'
import projectService, { type ProjectRecord } from '../services/projectService'
import chartService from '../services/chartService'
import datasetService from '../services/datasetService'
import reportService, {
  type ReportChartRecord,
  type ReportRecord,
} from '../services/reportService'
import { useProjectStore } from '../stores/projectStore'
import { useResponsiveStore } from '../stores/responsiveStore'

type BlockKind = 'chart' | 'section' | 'title' | 'subtitle' | 'paragraph' | 'notes' | 'source' | 'image' | 'video' | 'page'

type RenderableChart = {
  id: string
  type: string
  config: Record<string, unknown>
  dataset: unknown
}

type ReportLayoutItem = {
  id: string
  chartId: string
  chartName: string
  orderIndex: number
  chart: RenderableChart | null
}

type ChartDisplayOptions = {
  showTitle: boolean
  titleOverride: string
  showLegend: boolean
  widthPercent: number
  heightPx: number
}

type BlockLayout = {
  enabled: boolean
  x: number
  y: number
  width: number
  height: number
}

type ReportBlockItem = {
  id: string
  kind: BlockKind
  orderIndex: number
  chartRefId?: string
  text?: string
  mediaUrl?: string
  chartOptions?: ChartDisplayOptions
  layout?: BlockLayout
}

type ReportUiState = {
  blocks: ReportBlockItem[]
  pageMarginMm: number
  blockSpacingPx: number
}

type ReportUiStateMap = Record<string, ReportUiState>

type ProjectChartOption = {
  id: string
  name: string
  chartType: string
  previewChart: RenderableChart | null
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

const REPORT_UI_STATE_KEY = 'report-builder-ui-state-v1'
const CHART_SYNC_SIGNAL_KEY = 'chartBuilder:lastChartPersist'
const MM_TO_PX = 3.7795275591
const A4_WIDTH_PX = 794
const A4_HEIGHT_PX = 1123

const projectStore = useProjectStore()
const responsiveStore = useResponsiveStore()
const route = useRoute()
const router = useRouter()
const initialReportId = typeof route.query.reportId === 'string' ? route.query.reportId : ''
const initialMode = typeof route.query.mode === 'string' ? route.query.mode : ''
const pendingIncomingChartId = ref(typeof route.query.chartId === 'string' ? route.query.chartId : '')

const projects = ref<ProjectRecord[]>([])
const reports = ref<ReportRecord[]>([])
const availableCharts = ref<ProjectChartOption[]>([])
const layoutItems = ref<ReportLayoutItem[]>([])
const blocks = ref<ReportBlockItem[]>([])

const selectedProjectId = ref('')
const selectedReportId = ref(initialReportId)

const loading = ref(false)
const saving = ref(false)
const exporting = ref(false)
const message = ref('')

const previewMode = ref(initialMode === 'preview')
const pageMarginMm = ref(10)
const blockSpacingPx = ref(16)
const selectedChartControlBlockId = ref('')
const addPageAfterIndex = ref(0)
const activeTransformBlockId = ref('')
const reportZoomPercent = ref(100)

const quickInsertBlocks: Array<{
  kind: 'title' | 'subtitle' | 'paragraph' | 'image' | 'video'
  label: string
  icon: string
}> = [
  { kind: 'title', label: 'Title', icon: 'T' },
  { kind: 'subtitle', label: 'Subtitle', icon: 'ST' },
  { kind: 'paragraph', label: 'Paragraph', icon: 'P' },
  { kind: 'image', label: 'Image', icon: 'IMG' },
  { kind: 'video', label: 'Video', icon: 'VID' },
]

const chartSearch = ref('')
const chartTypeFilter = ref('all')
const shareOpen = ref(false)

const reportCaptureRef = ref<HTMLElement | null>(null)
let dragState: {
  blockId: string
  mode: 'move' | 'resize'
  startX: number
  startY: number
  originX: number
  originY: number
  originWidth: number
  originHeight: number
} | null = null

const sortedLayoutItems = computed(() =>
  [...layoutItems.value].sort((left, right) => left.orderIndex - right.orderIndex)
)

const chartTypeOptions = computed(() => {
  const types = new Set<string>()
  for (const item of availableCharts.value) {
    if (item.chartType) {
      types.add(item.chartType)
    }
  }
  return ['all', ...Array.from(types).sort((left, right) => left.localeCompare(right))]
})

const filteredAvailableCharts = computed(() => {
  const needle = chartSearch.value.trim().toLowerCase()
  return availableCharts.value.filter((item) => {
    const matchText = needle.length === 0
      || item.name.toLowerCase().includes(needle)
      || item.chartType.toLowerCase().includes(needle)
    const matchType = chartTypeFilter.value === 'all' || item.chartType === chartTypeFilter.value
    return matchText && matchType
  })
})

const sortedBlocks = computed(() =>
  [...blocks.value].sort((left, right) => left.orderIndex - right.orderIndex)
)

const reportPages = computed(() => {
  const pages: ReportBlockItem[][] = [[]]

  for (const block of sortedBlocks.value) {
    if (block.kind === 'page') {
      pages.push([])
      continue
    }

    pages[pages.length - 1]?.push(block)
  }

  return pages
})

const chartBlocks = computed(() =>
  sortedBlocks.value.filter((block) => block.kind === 'chart' && block.chartRefId)
)

const isMobile = computed(() => responsiveStore.deviceType === 'mobile')
const isTablet = computed(() => responsiveStore.deviceType === 'tablet')

const reportZoomScale = computed(() => {
  const value = Math.min(Math.max(reportZoomPercent.value, 50), 125)
  return value / 100
})

const selectedChartControlBlock = computed(() =>
  chartBlocks.value.find((block) => block.id === selectedChartControlBlockId.value) ?? null
)

const selectedChartControlOptions = computed(() => {
  const block = selectedChartControlBlock.value
  if (!block) {
    return getDefaultChartOptions('Chart')
  }

  return {
    ...getDefaultChartOptions(chartNameForBlock(block)),
    ...(block.chartOptions ?? {}),
  }
})

const reportSurfaceStyle = computed(() => ({
  padding: `${Math.round(pageMarginMm.value * MM_TO_PX)}px`,
  gap: `${blockSpacingPx.value}px`,
  width: `${A4_WIDTH_PX}px`,
  height: `${A4_HEIGHT_PX}px`,
}))

const reportCanvasStyle = computed(() => {
  if (previewMode.value || exporting.value) {
    return {
      zoom: '1',
    }
  }

  return {
    zoom: String(reportZoomScale.value),
  }
})

const shareUrl = computed(() => {
  if (!selectedReportId.value) {
    return ''
  }
  const base = `${window.location.origin}${window.location.pathname}`
  return `${base}?reportId=${encodeURIComponent(selectedReportId.value)}&mode=preview`
})

const shareHtmlSnippet = computed(() => {
  if (!shareUrl.value) {
    return ''
  }
  return `<a href="${shareUrl.value}" target="_blank" rel="noopener">Open report</a>`
})

const shareIframeSnippet = computed(() => {
  if (!shareUrl.value) {
    return ''
  }
  return `<iframe src="${shareUrl.value}" width="100%" height="900" style="border:1px solid #cbd5e1;border-radius:8px;"></iframe>`
})

function setMessage(text: string): void {
  message.value = text
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
    }
  }, 2600)
}

type ChartSyncPayload = {
  projectId?: string
  chartId?: string
  action?: 'saved' | 'deleted'
  timestamp?: number
}

function parseChartSyncPayload(raw: string | null | undefined): ChartSyncPayload | null {
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as ChartSyncPayload
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

async function refreshProjectCharts(reason: string, payload?: ChartSyncPayload): Promise<void> {
  const projectId = selectedProjectId.value
  if (!projectId) {
    return
  }

  if (payload?.projectId && payload.projectId !== projectId) {
    return
  }

  await loadCharts(projectId)

  if (selectedReportId.value) {
    await loadReportDetails(selectedReportId.value)
  }

  console.debug('Report builder chart refresh complete', {
    reason,
    projectId,
    selectedReportId: selectedReportId.value,
    availableChartIds: availableCharts.value.map((chart) => chart.id),
  })
}

async function handleChartStorageSync(event: StorageEvent): Promise<void> {
  if (event.key !== CHART_SYNC_SIGNAL_KEY) {
    return
  }

  const payload = parseChartSyncPayload(event.newValue)
  await refreshProjectCharts('storage-sync', payload ?? undefined)
}

async function handleChartPersistenceEvent(event: Event): Promise<void> {
  const payload = (event as CustomEvent<ChartSyncPayload>).detail
  await refreshProjectCharts('window-event', payload)
}

async function handleWindowFocus(): Promise<void> {
  await refreshProjectCharts('window-focus')
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

function normalizeOrder<T extends { orderIndex: number }>(items: T[]): T[] {
  return items
    .map((item, index) => ({ ...item, orderIndex: index }))
    .sort((left, right) => left.orderIndex - right.orderIndex)
}

function deepClone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function readReportUiStateMap(): ReportUiStateMap {
  try {
    const raw = localStorage.getItem(REPORT_UI_STATE_KEY)
    if (!raw) {
      return {}
    }
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') {
      return {}
    }
    return parsed as ReportUiStateMap
  } catch {
    return {}
  }
}

function persistReportUiState(reportId: string): void {
  if (!reportId) {
    return
  }

  const allStates = readReportUiStateMap()
  allStates[reportId] = {
    blocks: normalizeOrder(blocks.value),
    pageMarginMm: pageMarginMm.value,
    blockSpacingPx: blockSpacingPx.value,
  }
  localStorage.setItem(REPORT_UI_STATE_KEY, JSON.stringify(allStates))
}

function getDefaultChartOptions(chartName: string): ChartDisplayOptions {
  return {
    showTitle: true,
    titleOverride: chartName,
    showLegend: true,
    widthPercent: 100,
    heightPx: 360,
  }
}

function defaultChartLayout(index: number): BlockLayout {
  return {
    ...defaultBlockLayout(),
    enabled: true,
    x: 24 + ((index % 2) * 18),
    y: 120 + (index * 40),
    width: 640,
    height: 360,
  }
}

function createChartBlock(item: ReportLayoutItem, index = chartBlocks.value.length): ReportBlockItem {
  return {
    id: crypto.randomUUID(),
    kind: 'chart',
    orderIndex: 0,
    chartRefId: item.id,
    chartOptions: getDefaultChartOptions(item.chartName),
    layout: defaultChartLayout(index),
  }
}

function createBlock(kind: BlockKind): ReportBlockItem {
  const placeholders: Record<BlockKind, string> = {
    chart: '',
    section: 'Population Statistics',
    title: 'Report Title',
    subtitle: 'Subtitle',
    paragraph: 'Write your paragraph here.',
    notes: 'Notes',
    source: 'Source: ...',
    image: '',
    video: '',
    page: 'New Page',
  }

  const textLike = kind === 'section'
    || kind === 'title'
    || kind === 'subtitle'
    || kind === 'paragraph'
    || kind === 'notes'
    || kind === 'source'

  const mediaLike = kind === 'image' || kind === 'video'

  const movableTextOrMediaIndex = blocks.value.filter((item) =>
    item.kind === 'section'
    || item.kind === 'title'
    || item.kind === 'subtitle'
    || item.kind === 'paragraph'
    || item.kind === 'notes'
    || item.kind === 'source'
    || item.kind === 'image'
    || item.kind === 'video'
  ).length

  return {
    id: crypto.randomUUID(),
    kind,
    orderIndex: blocks.value.length,
    text: placeholders[kind],
    mediaUrl: '',
    layout: textLike || mediaLike
      ? {
          ...defaultBlockLayout(),
          enabled: true,
          width: mediaLike ? 640 : kind === 'title' ? 700 : kind === 'subtitle' ? 660 : 620,
          height: mediaLike
            ? 360
            : kind === 'title'
              ? 140
              : kind === 'section'
                ? 130
                : kind === 'subtitle'
                  ? 110
                  : kind === 'paragraph'
                    ? 260
                    : kind === 'notes'
                      ? 200
                      : kind === 'source'
                        ? 120
                        : 120,
          x: 28 + ((movableTextOrMediaIndex % 2) * 14),
          y: 120 + (movableTextOrMediaIndex * 36),
        }
      : undefined,
  }
}

function defaultBlockLayout(): BlockLayout {
  return {
    enabled: false,
    x: 24,
    y: 120,
    width: 640,
    height: 360,
  }
}

function buildBlocksFromState(reportId: string, charts: ReportLayoutItem[]): ReportBlockItem[] {
  const stateMap = readReportUiStateMap()
  const saved = stateMap[reportId]
  const chartByRef = new Map(charts.map((chart) => [chart.id, chart]))

  if (!saved || !Array.isArray(saved.blocks)) {
    return normalizeOrder(charts.map((item, index) => createChartBlock(item, index)))
  }

  pageMarginMm.value = Number.isFinite(saved.pageMarginMm) ? Math.min(Math.max(saved.pageMarginMm, 5), 30) : 10
  blockSpacingPx.value = Number.isFinite(saved.blockSpacingPx) ? Math.min(Math.max(saved.blockSpacingPx, 8), 48) : 16

  const rebuilt: ReportBlockItem[] = []
  const chartRefSeen = new Set<string>()

  for (const block of saved.blocks) {
    if (!block || typeof block !== 'object') {
      continue
    }

    const kind = String(block.kind ?? '') as BlockKind
    if (kind === 'chart') {
      const chartRefId = String(block.chartRefId ?? '')
      if (!chartRefId || !chartByRef.has(chartRefId)) {
        continue
      }
      chartRefSeen.add(chartRefId)
      const sourceChart = chartByRef.get(chartRefId)
      rebuilt.push({
        id: String(block.id ?? crypto.randomUUID()),
        kind: 'chart',
        orderIndex: 0,
        chartRefId,
        chartOptions: {
          ...getDefaultChartOptions(sourceChart?.chartName ?? 'Chart'),
          ...(block.chartOptions ?? {}),
        },
        layout: block.layout && typeof block.layout === 'object'
          ? {
              ...defaultBlockLayout(),
              ...(block.layout as Partial<BlockLayout>),
            }
          : defaultChartLayout(rebuilt.filter((item) => item.kind === 'chart').length),
      })
      continue
    }

    if (
      kind === 'section'
      || kind === 'title'
      || kind === 'subtitle'
      || kind === 'paragraph'
      || kind === 'notes'
      || kind === 'source'
      || kind === 'image'
      || kind === 'video'
      || kind === 'page'
    ) {
      rebuilt.push({
        id: String(block.id ?? crypto.randomUUID()),
        kind,
        orderIndex: 0,
        text: typeof block.text === 'string' ? block.text : '',
        mediaUrl: typeof block.mediaUrl === 'string' ? block.mediaUrl : '',
        layout: block.layout && typeof block.layout === 'object'
          ? {
              ...defaultBlockLayout(),
              ...(block.layout as Partial<BlockLayout>),
            }
          : undefined,
      })
    }
  }

  for (const chart of charts) {
    if (chartRefSeen.has(chart.id)) {
      continue
    }
    rebuilt.push(createChartBlock(chart, rebuilt.filter((item) => item.kind === 'chart').length))
  }

  const withFreeMoveEnabled = rebuilt.map((block) => {
    if (!isMovableBlock(block)) {
      return block
    }

    return {
      ...block,
      layout: {
        ...defaultBlockLayout(),
        ...(block.layout ?? {}),
        enabled: true,
      },
    }
  })

  return normalizeOrder(withFreeMoveEnabled)
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

async function toRenderableChart(response: ApiChart, fallbackId = ''): Promise<RenderableChart | null> {
  const configRaw = response.configJson ?? response.ConfigJson ?? response.configuration ?? response.Configuration ?? {}
  const styleRaw = response.styleJson ?? response.StyleJson ?? {}
  const parsedConfig = parseJson(configRaw) as {
    chartState?: {
      filteredData?: unknown
    }
    persistedState?: {
      filteredRows?: unknown
      allRows?: unknown
    }
    style?: Record<string, unknown>
  }
  const parsedStyle = parseJson(styleRaw)
  const datasetId = String(response.datasetId ?? response.DatasetId ?? '')
  const datasetRaw = response.dataset ?? response.Dataset ?? {}

  const savedChartFilteredRows = parsedConfig?.chartState?.filteredData
  const persistedFilteredRows = parsedConfig?.persistedState?.filteredRows
  const persistedAllRows = parsedConfig?.persistedState?.allRows

  const resolvedDataset = Array.isArray(savedChartFilteredRows)
    ? savedChartFilteredRows
    : Array.isArray(persistedFilteredRows)
    ? persistedFilteredRows
    : Array.isArray(persistedAllRows)
      ? persistedAllRows
      : datasetId
        ? await resolveDatasetById(datasetId)
        : await resolveDataset(datasetRaw)

  const baseConfig = parsedConfig && typeof parsedConfig === 'object' ? parsedConfig : {}
  const styleConfig = parsedStyle && typeof parsedStyle === 'object' ? parsedStyle as Record<string, unknown> : {}

  return {
    id: String(response.id ?? response.Id ?? fallbackId),
    type: String(response.chartType ?? response.ChartType ?? 'bar'),
    config: {
      ...baseConfig,
      style: {
        ...(baseConfig.style ?? {}),
        ...styleConfig,
      },
    },
    dataset: resolvedDataset,
  }
}

async function getRenderableChart(chartId: string): Promise<RenderableChart | null> {
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
    const requestedProjectId = typeof route.query.projectId === 'string' ? route.query.projectId : ''

    if (requestedProjectId && projects.value.some((project) => project.id === requestedProjectId)) {
      selectedProjectId.value = requestedProjectId
    } else if (projectStore.currentProject?.id) {
      selectedProjectId.value = projectStore.currentProject.id
    } else if (projects.value.length > 0) {
      const firstProject = projects.value[0]
      if (firstProject) {
        selectedProjectId.value = firstProject.id
      }
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

    console.debug('Report available charts loaded', {
      projectId,
      count: availableCharts.value.length,
      chartIds: availableCharts.value.map((chart) => chart.id),
    })
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
    blocks.value = []
    return
  }

  loading.value = true

  try {
    reports.value = await reportService.getReportsByProject(projectId)
    const requested = initialReportId
    if (requested && reports.value.some((report) => report.id === requested)) {
      selectedReportId.value = requested
    } else {
      selectedReportId.value = reports.value[0]?.id ?? ''
    }
  } catch {
    reports.value = []
    selectedReportId.value = ''
    layoutItems.value = []
    blocks.value = []
    setMessage('Unable to load reports for this project.')
  } finally {
    loading.value = false
  }
}

async function loadReportDetails(reportId: string): Promise<void> {
  if (!reportId) {
    layoutItems.value = []
    blocks.value = []
    return
  }

  loading.value = true

  try {
    const details = await reportService.getReportById(reportId)
    layoutItems.value = await hydrateLayoutItems(details.charts)
    blocks.value = buildBlocksFromState(reportId, sortedLayoutItems.value)
    console.debug('Report charts loaded', {
      reportId,
      projectId: selectedProjectId.value,
      chartIds: layoutItems.value.map((item) => item.chartId),
    })
  } catch {
    layoutItems.value = []
    blocks.value = []
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

  saving.value = true

  try {
    const chartLink = await reportService.addChartToReport({
      reportId: selectedReportId.value,
      chartId,
      orderIndex: nextOrderIndex(),
    })

    const fallback = availableCharts.value.find((item) => item.id === chartId)
    const addedItem: ReportLayoutItem = {
      id: chartLink.id,
      chartId: chartLink.chartId,
      chartName: fallback?.name ?? chartLink.chartName,
      orderIndex: chartLink.orderIndex,
      chart: await getRenderableChart(chartLink.chartId),
    }

    layoutItems.value = [...layoutItems.value, addedItem].sort((left, right) => left.orderIndex - right.orderIndex)
    blocks.value = normalizeOrder([...blocks.value, createChartBlock(addedItem, chartBlocks.value.length)])
    setMessage('Chart added to report.')
  } catch {
    setMessage('Failed to add chart to report.')
  } finally {
    saving.value = false
  }
}

async function consumeIncomingChart(): Promise<void> {
  if (!pendingIncomingChartId.value || !selectedReportId.value) {
    return
  }

  const incomingChartId = pendingIncomingChartId.value
  pendingIncomingChartId.value = ''

  if (selectedProjectId.value) {
    await loadCharts(selectedProjectId.value)
  }

  await addChart(incomingChartId)

  const cleanedQuery = { ...route.query }
  delete cleanedQuery.chartId
  delete cleanedQuery.projectId
  await router.replace({ query: cleanedQuery })
}

function startReportChartDrag(chartId: string, event: DragEvent): void {
  if (!selectedReportId.value || !chartId || !event.dataTransfer) {
    return
  }

  event.dataTransfer.effectAllowed = 'copy'
  event.dataTransfer.setData('application/x-chart-id', chartId)
  event.dataTransfer.setData('text/plain', `chart:${chartId}`)
}

function handleReportDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }
}

async function handleReportDrop(event: DragEvent): Promise<void> {
  event.preventDefault()

  let chartId = event.dataTransfer?.getData('application/x-chart-id') ?? ''
  if (!chartId) {
    const fallback = event.dataTransfer?.getData('text/plain') ?? ''
    if (fallback.startsWith('chart:')) {
      chartId = fallback.slice('chart:'.length).trim()
    }
  }

  if (!chartId) {
    return
  }

  await addChart(chartId)
}

function addContentBlock(kind: 'title' | 'subtitle' | 'paragraph' | 'image' | 'video'): void {
  if (!selectedReportId.value) {
    setMessage('Select a report first.')
    return
  }

  blocks.value = normalizeOrder([...blocks.value, createBlock(kind)])
}

function addPageBlock(): void {
  if (!selectedReportId.value) {
    setMessage('Select a report first.')
    return
  }

  const ordered = [...sortedBlocks.value]
  const targetPage = Math.min(Math.max(addPageAfterIndex.value, 0), Math.max(reportPages.value.length - 1, 0))
  let insertIndex = ordered.length
  let cursorPage = 0

  for (let index = 0; index < ordered.length; index += 1) {
    const item = ordered[index]
    if (!item) {
      continue
    }

    if (item.kind === 'page') {
      if (cursorPage === targetPage) {
        insertIndex = index
        break
      }
      cursorPage += 1
    }
  }

  ordered.splice(insertIndex, 0, createBlock('page'))
  blocks.value = normalizeOrder(ordered)
  addPageAfterIndex.value = Math.min(targetPage + 1, reportPages.value.length)
}

function updateBlockText(blockId: string, text: string): void {
  blocks.value = blocks.value.map((item) =>
    item.id === blockId
      ? {
          ...item,
          text,
        }
      : item
  )
}

function updateBlockMedia(blockId: string, mediaUrl: string): void {
  blocks.value = blocks.value.map((item) =>
    item.id === blockId
      ? {
          ...item,
          mediaUrl,
        }
      : item
  )
}

function updateChartOptions(
  blockId: string,
  patch: Partial<ChartDisplayOptions>,
): void {
  blocks.value = blocks.value.map((item) => {
    if (item.id !== blockId || item.kind !== 'chart') {
      return item
    }

    return {
      ...item,
      chartOptions: {
        ...getDefaultChartOptions(item.chartOptions?.titleOverride || 'Chart'),
        ...(item.chartOptions ?? {}),
        ...patch,
      },
    }
  })
}

function updateBlockLayout(blockId: string, patch: Partial<BlockLayout>): void {
  blocks.value = blocks.value.map((item) => {
    if (item.id !== blockId) {
      return item
    }

    return {
      ...item,
      layout: {
        ...defaultBlockLayout(),
        ...(item.layout ?? {}),
        ...patch,
      },
    }
  })
}

function isTextBlock(kind: BlockKind): boolean {
  return kind === 'section'
    || kind === 'title'
    || kind === 'subtitle'
    || kind === 'paragraph'
    || kind === 'notes'
    || kind === 'source'
}

function isMovableBlock(block: ReportBlockItem): boolean {
  return block.kind === 'chart' || block.kind === 'image' || block.kind === 'video' || isTextBlock(block.kind)
}

function setBlockFreeMove(blockId: string, enabled: boolean): void {
  const block = blocks.value.find((item) => item.id === blockId)
  if (!block || !isMovableBlock(block)) {
    return
  }

  if (!enabled) {
    updateBlockLayout(blockId, { enabled: false })
    return
  }

  const existingLayout = block.layout
  if (existingLayout?.enabled) {
    updateBlockLayout(blockId, { enabled: true })
    return
  }

  const blockElement = document.querySelector<HTMLElement>(`.report-block[data-block-id="${blockId}"]`)
  const pageElement = blockElement?.closest<HTMLElement>('.report-page')
  if (!blockElement || !pageElement) {
    updateBlockLayout(blockId, { enabled: true })
    return
  }

  const blockRect = blockElement.getBoundingClientRect()
  const pageRect = pageElement.getBoundingClientRect()

  updateBlockLayout(blockId, {
    enabled: true,
    x: Math.max(0, Math.round(blockRect.left - pageRect.left)),
    y: Math.max(0, Math.round(blockRect.top - pageRect.top)),
    width: Math.max(220, Math.round(blockRect.width)),
    height: Math.max(100, Math.round(blockRect.height)),
  })
}

function handleBlockSelect(block: ReportBlockItem): void {
  if (previewMode.value || !isMovableBlock(block)) {
    return
  }
  activeTransformBlockId.value = block.id
}

function shouldIgnoreDirectDrag(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false
  }

  return Boolean(target.closest('input, textarea, select, button, video, a, label, .resize-handle, .transform-btn'))
}

function startDirectMove(block: ReportBlockItem, event: MouseEvent): void {
  if (previewMode.value || !isMovableBlock(block) || !block.layout?.enabled) {
    return
  }

  if (shouldIgnoreDirectDrag(event.target)) {
    return
  }

  activateTransform(block.id)
  startMove(block.id, event)
}

function updateSelectedChartFreeMove(enabled: boolean): void {
  const block = selectedChartControlBlock.value
  if (!block) {
    return
  }

  setBlockFreeMove(block.id, enabled)
  if (enabled) {
    activeTransformBlockId.value = block.id
  }
}

function updateSelectedChartLayoutSize(patch: Partial<BlockLayout>): void {
  const block = selectedChartControlBlock.value
  if (!block) {
    return
  }

  if (!block.layout?.enabled) {
    setBlockFreeMove(block.id, true)
  }

  updateBlockLayout(block.id, patch)
}

function chartTypeIconLabel(type: string): string {
  const normalized = type.toLowerCase()
  if (normalized === 'bar') return 'BAR'
  if (normalized === 'line') return 'LIN'
  if (normalized === 'area') return 'ARE'
  if (normalized === 'pie') return 'PIE'
  if (normalized === 'map') return 'MAP'
  if (normalized === 'scatter') return 'SCT'
  if (normalized === 'bubble') return 'BUB'
  if (normalized === 'dotdonut') return 'DOT'
  if (normalized === 'orbitdonut') return 'ORB'
  if (normalized === 'stackedbar') return 'STK'
  return normalized.slice(0, 3).toUpperCase()
}

function isDeletableBlock(block: ReportBlockItem): boolean {
  return block.kind !== 'page'
}

async function deleteBlock(block: ReportBlockItem): Promise<void> {
  if (saving.value) {
    return
  }

  if (block.kind === 'chart' && block.chartRefId) {
    saving.value = true
    try {
      await reportService.removeReportChart(block.chartRefId)
      layoutItems.value = layoutItems.value.filter((item) => item.id !== block.chartRefId)
      blocks.value = normalizeOrder(blocks.value.filter((item) => item.id !== block.id))
      if (activeTransformBlockId.value === block.id) {
        activeTransformBlockId.value = ''
      }
      setMessage('Chart removed from report.')
    } catch {
      setMessage('Failed to remove chart from report.')
    } finally {
      saving.value = false
    }
    return
  }

  blocks.value = normalizeOrder(blocks.value.filter((item) => item.id !== block.id))
  if (activeTransformBlockId.value === block.id) {
    activeTransformBlockId.value = ''
  }
  setMessage('Block removed.')
}

function blockStyle(block: ReportBlockItem): Record<string, string> {
  const layout = block.layout
  if (!layout?.enabled) {
    return {}
  }

  const widthScale = layout.width / 640
  const heightScale = layout.height / 360
  const textScale = Math.max(0.72, Math.min(1.45, Math.min(widthScale, heightScale)))

  return {
    position: 'absolute',
    left: `${layout.x}px`,
    top: `${layout.y}px`,
    width: `${layout.width}px`,
    height: `${layout.height}px`,
    padding: '0',
    border: 'none',
    background: 'transparent',
    zIndex: activeTransformBlockId.value === block.id ? '4' : '2',
    '--rb-base-font': `${Math.round(14 * textScale)}px`,
    '--rb-source-font': `${Math.round(12 * textScale)}px`,
    '--rb-section-font': `${Math.round(24 * textScale)}px`,
    '--rb-title-font': `${Math.round(32 * textScale)}px`,
    '--rb-subtitle-font': `${Math.round(22 * textScale)}px`,
  }
}

function chartStageStyle(block: ReportBlockItem): Record<string, string> {
  const layout = block.layout
  if (layout?.enabled) {
    const edgePadding = Math.max(4, Math.min(18, Math.round(Math.min(layout.width, layout.height) * 0.04)))

    return {
      width: '100%',
      height: '100%',
      margin: '0',
      padding: `${edgePadding}px`,
      boxSizing: 'border-box',
    }
  }

  const maxHeight = isMobile.value
    ? 320
    : isTablet.value
      ? 420
      : 620
  const responsiveHeight = Math.min(block.chartOptions?.heightPx ?? 360, maxHeight)

  return {
    width: `${block.chartOptions?.widthPercent ?? 100}%`,
    height: `${responsiveHeight}px`,
    padding: '8px',
    boxSizing: 'border-box',
  }
}

function mediaStageStyle(block: ReportBlockItem): Record<string, string> {
  const layout = block.layout
  if (layout?.enabled) {
    return {
      width: '100%',
      height: '100%',
      minHeight: '0',
      margin: '0',
      padding: '6px',
    }
  }

  return {}
}

function activateTransform(blockId: string): void {
  if (previewMode.value) {
    return
  }
  activeTransformBlockId.value = blockId
}

function startMove(blockId: string, event: MouseEvent): void {
  const block = blocks.value.find((item) => item.id === blockId)
  if (!block?.layout?.enabled) {
    return
  }

  dragState = {
    blockId,
    mode: 'move',
    startX: event.clientX,
    startY: event.clientY,
    originX: block.layout.x,
    originY: block.layout.y,
    originWidth: block.layout.width,
    originHeight: block.layout.height,
  }
}

function startResize(blockId: string, event: MouseEvent): void {
  const block = blocks.value.find((item) => item.id === blockId)
  if (!block?.layout?.enabled) {
    return
  }

  dragState = {
    blockId,
    mode: 'resize',
    startX: event.clientX,
    startY: event.clientY,
    originX: block.layout.x,
    originY: block.layout.y,
    originWidth: block.layout.width,
    originHeight: block.layout.height,
  }
}

function onPointerMove(event: MouseEvent): void {
  if (!dragState) {
    return
  }

  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY
  const block = blocks.value.find((item) => item.id === dragState.blockId)

  if (dragState.mode === 'move') {
    if (block?.layout?.enabled) {
      const nextY = dragState.originY + dy
      const currentPageIndex = getPageIndexForBlock(dragState.blockId)
      const pageShiftThreshold = 40

      if (nextY < -pageShiftThreshold && currentPageIndex > 0) {
        const shiftedY = Math.max(20, A4_HEIGHT_PX - block.layout.height - 40)
        moveBlockToPage(dragState.blockId, currentPageIndex - 1, shiftedY)
        dragState = {
          ...dragState,
          startX: event.clientX,
          startY: event.clientY,
          originX: block.layout.x,
          originY: shiftedY,
        }
        return
      }

      if (nextY + block.layout.height > A4_HEIGHT_PX + pageShiftThreshold && currentPageIndex < reportPages.value.length - 1) {
        const shiftedY = 28
        moveBlockToPage(dragState.blockId, currentPageIndex + 1, shiftedY)
        dragState = {
          ...dragState,
          startX: event.clientX,
          startY: event.clientY,
          originX: block.layout.x,
          originY: shiftedY,
        }
        return
      }
    }

    updateBlockLayout(dragState.blockId, {
      x: Math.max(0, dragState.originX + dx),
      y: Math.max(0, dragState.originY + dy),
    })
    return
  }

  updateBlockLayout(dragState.blockId, {
    width: Math.max(220, dragState.originWidth + dx),
    height: Math.max(180, dragState.originHeight + dy),
  })
}

function onPointerUp(): void {
  dragState = null
}

function updateSelectedChartOptions(patch: Partial<ChartDisplayOptions>): void {
  const block = selectedChartControlBlock.value
  if (!block) {
    return
  }

  updateChartOptions(block.id, patch)
}

function getPageIndexForBlock(blockId: string): number {
  let pageIndex = 0

  for (const block of sortedBlocks.value) {
    if (block.kind === 'page') {
      pageIndex += 1
      continue
    }

    if (block.id === blockId) {
      return pageIndex
    }
  }

  return 0
}

function pageInsertIndex(pageIndex: number, ordered: ReportBlockItem[]): number {
  let cursorPage = 0

  for (let index = 0; index < ordered.length; index += 1) {
    const item = ordered[index]
    if (!item) {
      continue
    }

    if (item.kind === 'page') {
      if (cursorPage === pageIndex) {
        return index
      }
      cursorPage += 1
    }
  }

  return ordered.length
}

function moveBlockToPage(blockId: string, targetPageIndex: number, nextY: number): void {
  const ordered = [...sortedBlocks.value]
  const currentIndex = ordered.findIndex((item) => item.id === blockId)
  if (currentIndex < 0) {
    return
  }

  const [movedBlock] = ordered.splice(currentIndex, 1)
  if (!movedBlock) {
    return
  }

  const safePageIndex = Math.max(0, Math.min(targetPageIndex, reportPages.value.length - 1))
  const insertIndex = pageInsertIndex(safePageIndex, ordered)
  ordered.splice(insertIndex, 0, movedBlock)
  blocks.value = normalizeOrder(ordered)
  updateBlockLayout(blockId, { y: nextY })
}

function getFigureNumber(blockId: string): number {
  let index = 0
  for (const block of sortedBlocks.value) {
    if (block.kind === 'chart') {
      index += 1
      if (block.id === blockId) {
        return index
      }
    }
  }
  return 0
}

function findChartForBlock(block: ReportBlockItem): ReportLayoutItem | null {
  if (block.kind !== 'chart' || !block.chartRefId) {
    return null
  }
  return layoutItems.value.find((item) => item.id === block.chartRefId) ?? null
}

function chartNameForBlock(block: ReportBlockItem): string {
  const chart = findChartForBlock(block)
  const fallback = block.chartOptions?.titleOverride?.trim() || 'Chart'
  return chart?.chartName || fallback
}

function chartRendererForBlock(block: ReportBlockItem): RenderableChart | null {
  const chart = findChartForBlock(block)
  return applyChartOptions(block, chart?.chart ?? null)
}

function toRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object') {
    return {}
  }
  return value as Record<string, unknown>
}

function applyChartOptions(block: ReportBlockItem, chart: RenderableChart | null): RenderableChart | null {
  if (!chart) {
    return null
  }

  const next = deepClone(chart)
  const options = {
    ...getDefaultChartOptions(block.chartOptions?.titleOverride || 'Chart'),
    ...(block.chartOptions ?? {}),
  }
  const config = toRecord(next.config)
  const titleText = options.showTitle ? options.titleOverride.trim() : ''

  config.title = titleText
  config.animation = false

  const lineConfig = toRecord(config.lineConfig)
  lineConfig.title = titleText
  lineConfig.animate = false
  lineConfig.duration = 0
  config.lineConfig = lineConfig

  const areaConfig = toRecord(config.areaConfig)
  areaConfig.title = titleText
  areaConfig.animate = false
  areaConfig.duration = 0
  config.areaConfig = areaConfig

  const scatterConfig = toRecord(config.scatterConfig)
  scatterConfig.showLegend = options.showLegend
  scatterConfig.animationDuration = 0
  config.scatterConfig = scatterConfig

  const stackedBarConfig = toRecord(config.stackedBarConfig)
  stackedBarConfig.showLegend = options.showLegend
  stackedBarConfig.animationDuration = 0
  config.stackedBarConfig = stackedBarConfig

  const pieConfig = toRecord(config.pieConfig)
  pieConfig.showLegend = options.showLegend
  pieConfig.animationDuration = 0
  config.pieConfig = pieConfig

  const barConfig = toRecord(config.barConfig)
  barConfig.animationDuration = 0
  barConfig.staggerDelay = 0
  config.barConfig = barConfig

  const mapConfig = toRecord(config.mapConfig)
  mapConfig.animationDuration = 0
  config.mapConfig = mapConfig

  const bubbleConfig = toRecord(config.bubbleConfig)
  bubbleConfig.animationDuration = 0
  config.bubbleConfig = bubbleConfig

  const dotDonutConfig = toRecord(config.dotDonutConfig)
  dotDonutConfig.animationDuration = 0
  config.dotDonutConfig = dotDonutConfig

  const orbitDonutConfig = toRecord(config.orbitDonutConfig)
  orbitDonutConfig.animationDuration = 0
  config.orbitDonutConfig = orbitDonutConfig

  config.showLegend = options.showLegend
  next.config = config
  return next
}

function handleMediaUpload(blockId: string, event: Event): void {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) {
    return
  }

  const reader = new FileReader()
  reader.onload = (loadEvent) => {
    const result = loadEvent.target?.result
    if (typeof result === 'string') {
      updateBlockMedia(blockId, result)
    }
  }
  reader.readAsDataURL(file)
}

async function copyText(value: string, successMessage: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value)
    setMessage(successMessage)
  } catch {
    setMessage('Unable to copy to clipboard.')
  }
}

function sanitizePrintPage(page: HTMLElement): HTMLElement {
  const clone = page.cloneNode(true) as HTMLElement

  clone.querySelectorAll('.transform-controls, .delete-handle, .page-banner').forEach((node) => node.remove())
  clone.querySelectorAll('.report-block--active').forEach((node) => node.classList.remove('report-block--active'))

  const originalFields = page.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  const clonedFields = clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')
  originalFields.forEach((field, index) => {
    const target = clonedFields[index]
    if (!target) {
      return
    }

    if (target instanceof HTMLTextAreaElement && field instanceof HTMLTextAreaElement) {
      target.textContent = field.value
      target.value = field.value
      return
    }

    target.setAttribute('value', field.value)
    target.value = field.value
  })

  return clone
}

function collectPrintDocument(): string {
  const element = reportCaptureRef.value
  if (!element) {
    return ''
  }

  const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join('\n')

  const pages = Array.from(element.querySelectorAll<HTMLElement>('.report-page'))
    .map((page) => sanitizePrintPage(page).outerHTML)
    .join('\n')

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Report export</title>
    ${styles}
    <style>
      @page {
        size: A4;
        margin: 0;
      }

      body {
        margin: 0;
        padding: 24px 0;
        background: #eef2f7;
      }

      .report-page {
        width: ${A4_WIDTH_PX}px !important;
        height: ${A4_HEIGHT_PX}px !important;
        min-height: ${A4_HEIGHT_PX}px !important;
        margin: 0 auto 16px !important;
        break-after: page;
        page-break-after: always;
        overflow: hidden !important;
        box-shadow: none !important;
      }

      .report-page:last-child {
        break-after: auto;
        page-break-after: auto;
      }

      .report-page,
      .report-page * {
        border: none !important;
        box-shadow: none !important;
        filter: none !important;
        outline: none !important;
      }
    </style>
  </head>
  <body>
    ${pages}
  </body>
</html>`
}

async function openPrintExport(autoPrint: boolean): Promise<void> {
  const element = reportCaptureRef.value
  if (!element) {
    setMessage('Report preview area is not available.')
    return
  }

  await nextTick()

  const pages = Array.from(element.querySelectorAll<HTMLElement>('.report-page'))
  if (pages.length === 0) {
    setMessage('No report pages are available for export.')
    return
  }

  const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=1280,height=960')
  if (!printWindow) {
    setMessage('Popup blocked. Allow popups to export the report.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(collectPrintDocument())
  printWindow.document.close()

  if (autoPrint) {
    printWindow.addEventListener('load', () => {
      printWindow.focus()
      printWindow.print()
    }, { once: true })
  }
}

function buildPdfFileName(): string {
  const selectedReport = reports.value.find((item) => item.id === selectedReportId.value)
  const base = selectedReport?.name || 'report'
  const date = new Date().toISOString().slice(0, 10)
  return `${base}_${date}.pdf`
}

async function exportPdf(): Promise<void> {
  if (!selectedReportId.value || exporting.value) {
    return
  }

  const previousPreviewMode = previewMode.value
  exporting.value = true
  try {
    previewMode.value = true
    await nextTick()
    await new Promise((resolve) => window.setTimeout(resolve, 220))

    const element = reportCaptureRef.value
    if (!element) {
      setMessage('Report preview area is not available.')
      return
    }

    const pages = Array.from(element.querySelectorAll<HTMLElement>('.report-page'))
    if (pages.length === 0) {
      setMessage('No report pages are available for export.')
      return
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })

    const pdfWidth = 210
    const pdfHeight = 297

    for (let index = 0; index < pages.length; index += 1) {
      const page = pages[index]
      const canvas = await html2canvas(page, {
        scale: 3,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      })

      const imageData = canvas.toDataURL('image/png')

      if (index > 0) {
        pdf.addPage()
      }

      pdf.addImage(imageData, 'PNG', 0, 0, pdfWidth, pdfHeight, undefined, 'SLOW')
    }

    pdf.save(buildPdfFileName())
    setMessage('High-quality PDF downloaded successfully.')
  } catch {
    setMessage('Failed to export PDF.')
  } finally {
    previewMode.value = previousPreviewMode
    exporting.value = false
  }
}

async function previewPdf(): Promise<void> {
  if (!selectedReportId.value || exporting.value) {
    return
  }

  exporting.value = true
  try {
    await openPrintExport(false)
  } catch {
    setMessage('Failed to preview PDF.')
  } finally {
    exporting.value = false
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
  await consumeIncomingChart()
})

watch(
  chartBlocks,
  (items) => {
    const currentId = selectedChartControlBlockId.value
    if (currentId && items.some((item) => item.id === currentId)) {
      return
    }

    selectedChartControlBlockId.value = items[0]?.id ?? ''
  },
  { immediate: true },
)

watch(
  selectedChartControlBlock,
  (block) => {
    if (!block || previewMode.value) {
      return
    }

    if (!block.layout?.enabled) {
      setBlockFreeMove(block.id, true)
    }
  },
  { immediate: true },
)

watch(
  reportPages,
  (pages) => {
    const maxIndex = Math.max(pages.length - 1, 0)
    if (addPageAfterIndex.value > maxIndex) {
      addPageAfterIndex.value = maxIndex
    }
  },
  { immediate: true },
)

watch(
  [selectedReportId, blocks, pageMarginMm, blockSpacingPx],
  ([reportId]) => {
    if (!reportId) {
      return
    }
    persistReportUiState(reportId)
  },
  { deep: true },
)

onMounted(async () => {
  window.addEventListener('storage', handleChartStorageSync)
  window.addEventListener('chartBuilder:charts-updated', handleChartPersistenceEvent as EventListener)
  window.addEventListener('focus', handleWindowFocus)
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)

  await loadProjects()

  if (selectedProjectId.value) {
    await Promise.all([loadCharts(selectedProjectId.value), loadReports(selectedProjectId.value)])
  }

  if (selectedReportId.value) {
    await loadReportDetails(selectedReportId.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleChartStorageSync)
  window.removeEventListener('chartBuilder:charts-updated', handleChartPersistenceEvent as EventListener)
  window.removeEventListener('focus', handleWindowFocus)
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
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
        :loading="loading || saving || exporting"
        @update:selected-project-id="selectedProjectId = $event"
        @update:selected-report-id="selectedReportId = $event"
        @create-report="createReport"
      />
    </header>

    <section class="action-toolbar">
      <div class="left-tools">
        <button class="toolbar-btn" :class="{ active: !previewMode }" @click="previewMode = false">Edit Mode</button>
        <button class="toolbar-btn" :class="{ active: previewMode }" @click="previewMode = true">Preview Mode</button>

        <label class="range-field">
          <span>Page Margin (A4)</span>
          <input v-model.number="pageMarginMm" type="range" min="5" max="30" step="1" />
          <strong>{{ pageMarginMm }}mm</strong>
        </label>

        <label class="range-field">
          <span>Block Spacing</span>
          <input v-model.number="blockSpacingPx" type="range" min="8" max="48" step="2" />
          <strong>{{ blockSpacingPx }}px</strong>
        </label>

        <label v-if="!previewMode" class="range-field range-field--zoom">
          <span>Page Zoom</span>
          <select v-model.number="reportZoomPercent" class="type-filter">
            <option :value="50">50%</option>
            <option :value="75">75%</option>
            <option :value="100">100%</option>
            <option :value="125">125%</option>
          </select>
          <strong>{{ reportZoomPercent }}%</strong>
        </label>
      </div>

      <div class="right-tools">
        <button class="icon-btn" :disabled="exporting || !selectedReportId" @click="previewMode = true" title="Preview Mode">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5C6 5 2.2 9.7 1 12c1.2 2.3 5 7 11 7s9.8-4.7 11-7c-1.2-2.3-5-7-11-7zm0 11a4 4 0 110-8 4 4 0 010 8z"/></svg>
        </button>
        <button class="icon-btn" :disabled="exporting || !selectedReportId" @click="exportPdf" title="Download High-Quality PDF">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v10m0 0l4-4m-4 4L8 9M5 15v4h14v-4"/></svg>
        </button>
        <div class="share-wrap">
          <button class="icon-btn" :disabled="!selectedReportId" @click="shareOpen = !shareOpen" title="Share">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a3 3 0 10-2.8-4H15a3 3 0 000 6 3 3 0 002.2-1l-8 4a3 3 0 100 2l8 4A3 3 0 1018 16a3 3 0 00-2.2 1l-8-4a3 3 0 000-2l8-4A3 3 0 0018 8z"/></svg>
          </button>
          <div v-if="shareOpen" class="share-panel">
            <p class="hint">Share HTML or iframe embed snippets.</p>
            <button class="secondary-btn" @click="copyText(shareHtmlSnippet, 'HTML snippet copied.')">Copy HTML</button>
            <button class="secondary-btn" @click="copyText(shareIframeSnippet, 'Iframe snippet copied.')">Copy iframe</button>
          </div>
        </div>
      </div>
    </section>

    <p v-if="message" class="message">{{ message }}</p>

    <section v-if="!previewMode && chartBlocks.length > 0" class="global-chart-controls">
      <header class="global-chart-controls__header">
        <h3>Chart Display Controls</h3>
        <p class="hint">Select a chart and apply title, legend, and size options.</p>
      </header>

      <div class="global-chart-controls__grid">
        <label class="global-chart-controls__field">
          <span>Selected Chart</span>
          <select v-model="selectedChartControlBlockId" class="type-filter">
            <option v-for="block in chartBlocks" :key="block.id" :value="block.id">
              Figure {{ getFigureNumber(block.id) }} - {{ chartNameForBlock(block) }}
            </option>
          </select>
        </label>

        <div class="chart-controls chart-controls--global">
          <div class="chart-controls__checks">
            <label>
              <input
                :checked="selectedChartControlBlock?.layout?.enabled ?? false"
                type="checkbox"
                @change="updateSelectedChartFreeMove(($event.target as HTMLInputElement).checked)"
              />
              Enable Move / Resize
            </label>

            <label>
              <input
                :checked="selectedChartControlOptions.showTitle"
                type="checkbox"
                @change="updateSelectedChartOptions({ showTitle: ($event.target as HTMLInputElement).checked })"
              />
              Show Title
            </label>

            <label>
              <input
                :checked="selectedChartControlOptions.showLegend"
                type="checkbox"
                @change="updateSelectedChartOptions({ showLegend: ($event.target as HTMLInputElement).checked })"
              />
              Show Legend
            </label>
          </div>

          <div class="chart-controls__line">
            <input
              class="text-input"
              :value="selectedChartControlOptions.titleOverride"
              type="text"
              placeholder="Chart title override"
              @input="updateSelectedChartOptions({ titleOverride: ($event.target as HTMLInputElement).value })"
            />

            <div class="size-row">
              <label>
                Width
                <input
                  :value="selectedChartControlBlock?.layout?.enabled ? (selectedChartControlBlock?.layout?.width ?? 640) : selectedChartControlOptions.widthPercent"
                  type="range"
                  :min="selectedChartControlBlock?.layout?.enabled ? 220 : 50"
                  :max="selectedChartControlBlock?.layout?.enabled ? 1200 : 100"
                  :step="selectedChartControlBlock?.layout?.enabled ? 10 : 5"
                  @input="selectedChartControlBlock?.layout?.enabled
                    ? updateSelectedChartLayoutSize({ width: Number(($event.target as HTMLInputElement).value) })
                    : updateSelectedChartOptions({ widthPercent: Number(($event.target as HTMLInputElement).value) })"
                />
                <span>{{ selectedChartControlBlock?.layout?.enabled ? (selectedChartControlBlock?.layout?.width ?? 640) + 'px' : selectedChartControlOptions.widthPercent + '%' }}</span>
              </label>

              <label>
                Height
                <input
                  :value="selectedChartControlBlock?.layout?.enabled ? (selectedChartControlBlock?.layout?.height ?? 360) : selectedChartControlOptions.heightPx"
                  type="range"
                  min="220"
                  :max="selectedChartControlBlock?.layout?.enabled ? 900 : 620"
                  step="10"
                  @input="selectedChartControlBlock?.layout?.enabled
                    ? updateSelectedChartLayoutSize({ height: Number(($event.target as HTMLInputElement).value) })
                    : updateSelectedChartOptions({ heightPx: Number(($event.target as HTMLInputElement).value) })"
                />
                <span>{{ selectedChartControlBlock?.layout?.enabled ? (selectedChartControlBlock?.layout?.height ?? 360) + 'px' : selectedChartControlOptions.heightPx + 'px' }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="content-grid" :class="{ 'content-grid--preview': previewMode }">
      <aside v-if="!previewMode" class="chart-picker">
        <h2>Project Charts</h2>

        <div class="insert-controls">
          <label>Insert Block</label>
          <div class="insert-icon-row" role="group" aria-label="Insert block types">
            <button
              v-for="item in quickInsertBlocks"
              :key="item.kind"
              class="insert-icon-btn"
              type="button"
              :title="item.label"
              :aria-label="`Insert ${item.label}`"
              :disabled="!selectedReportId"
              @click="addContentBlock(item.kind)"
            >
              <span class="insert-icon-btn__glyph">{{ item.icon }}</span>
            </button>
          </div>

          <label for="page-after">Add Page After</label>
          <select id="page-after" v-model.number="addPageAfterIndex" class="type-filter">
            <option v-for="(_, pageIndex) in reportPages" :key="`page-after-${pageIndex}`" :value="pageIndex">
              Page {{ pageIndex + 1 }}
            </option>
          </select>
          <button class="secondary-btn add-page-btn" :disabled="!selectedReportId" @click="addPageBlock">Add Page</button>
        </div>

        <button
          v-for="chart in filteredAvailableCharts"
          :key="chart.id"
          class="chart-item chart-card"
          :disabled="saving || !selectedReportId"
          draggable="true"
          @dragstart="startReportChartDrag(chart.id, $event)"
          @click="addChart(chart.id)"
        >
          <div class="chart-card__head">
            <span class="chart-type-icon" :title="chart.chartType">{{ chartTypeIconLabel(chart.chartType) }}</span>
            <div class="chart-card__meta">
              <span class="chart-card__name">{{ chart.name }}</span>
              <small>{{ chart.chartType }}</small>
            </div>
          </div>
        </button>

        <p v-if="filteredAvailableCharts.length === 0" class="hint">No charts match your filters.</p>
      </aside>

      <section
        class="report-preview"
        :class="{ 'report-preview--clean': previewMode || exporting }"
        @dragover="handleReportDragOver"
        @dragenter.prevent
        @drop="handleReportDrop"
      >
        <div class="pdf-surface" :style="reportCanvasStyle" ref="reportCaptureRef" @dragover="handleReportDragOver" @dragenter.prevent @drop="handleReportDrop">
          <p v-if="loading" class="hint">Loading report content...</p>
          <p v-else-if="sortedBlocks.length === 0" class="hint">No blocks in this report yet.</p>

          <div
            v-for="(pageBlocks, pageIndex) in reportPages"
            v-else
            :key="`report-page-${pageIndex}`"
            class="report-page"
            :style="reportSurfaceStyle"
          >
            <div v-if="!previewMode && !exporting" class="page-banner">Page {{ pageIndex + 1 }}</div>

            <p v-if="pageBlocks.length === 0" class="hint">This page is empty.</p>

            <article
              v-for="block in pageBlocks"
              :key="block.id"
              class="report-block"
              :data-block-id="block.id"
              :class="[
                `report-block--${block.kind}`,
                {
                  'report-block--floating': block.layout?.enabled,
                  'report-block--active': activeTransformBlockId === block.id,
                },
              ]"
              :style="blockStyle(block)"
              @click.stop="handleBlockSelect(block)"
              @mousedown.left.stop="startDirectMove(block, $event)"
            >
              <button
                v-if="!previewMode && !exporting && isDeletableBlock(block) && activeTransformBlockId === block.id"
                class="delete-handle"
                type="button"
                title="Delete block"
                @click.stop="deleteBlock(block)"
              >
                ×
              </button>

              <template v-if="block.kind === 'chart'">
                <template v-if="findChartForBlock(block)">
                  <template v-if="chartRendererForBlock(block)">
                    <div
                      class="chart-stage"
                      :style="chartStageStyle(block)"
                      @click.stop="activateTransform(block.id)"
                    >
                      <ChartRenderer :key="`${block.id}-${block.chartRefId ?? 'chart'}`" class="report-chart-renderer" :chart="chartRendererForBlock(block)!" />
                    </div>
                  </template>
                </template>
                <p v-else class="hint">Chart is no longer available.</p>
              </template>

              <template v-else-if="block.kind === 'section'">
                <input
                  v-if="!previewMode"
                  class="section-input"
                  :value="block.text || ''"
                  type="text"
                  placeholder="Section title"
                  @input="updateBlockText(block.id, ($event.target as HTMLInputElement).value)"
                />
                <h2 v-else class="section-title">{{ block.text || 'Section title' }}</h2>
              </template>

              <template v-else-if="block.kind === 'title'">
                <input
                  v-if="!previewMode"
                  class="title-input"
                  :value="block.text || ''"
                  type="text"
                  placeholder="Report title"
                  @input="updateBlockText(block.id, ($event.target as HTMLInputElement).value)"
                />
                <h1 v-else class="text-title">{{ block.text || 'Report title' }}</h1>
              </template>

              <template v-else-if="block.kind === 'subtitle'">
                <input
                  v-if="!previewMode"
                  class="subtitle-input"
                  :value="block.text || ''"
                  type="text"
                  placeholder="Subtitle"
                  @input="updateBlockText(block.id, ($event.target as HTMLInputElement).value)"
                />
                <h3 v-else class="text-subtitle">{{ block.text || 'Subtitle' }}</h3>
              </template>

              <template v-else-if="block.kind === 'paragraph' || block.kind === 'notes' || block.kind === 'source'">
                <textarea
                  v-if="!previewMode"
                  :class="[
                    'textarea-input',
                    block.kind === 'paragraph'
                      ? 'textarea-input--paragraph'
                      : block.kind === 'notes'
                        ? 'textarea-input--notes'
                        : 'textarea-input--source'
                  ]"
                  :rows="block.kind === 'paragraph' ? 7 : block.kind === 'notes' ? 5 : 3"
                  :value="block.text || ''"
                  :placeholder="block.kind === 'paragraph' ? 'Paragraph text' : block.kind === 'notes' ? 'Notes' : 'Source'"
                  @input="updateBlockText(block.id, ($event.target as HTMLTextAreaElement).value)"
                ></textarea>
                <p v-else :class="block.kind === 'source' ? 'text-source' : 'text-paragraph'">{{ block.text || '' }}</p>
              </template>

              <template v-else-if="block.kind === 'image' || block.kind === 'video'">
                <div v-if="!previewMode" class="media-controls">
                  <label>
                    <input
                      :checked="block.layout?.enabled ?? false"
                      type="checkbox"
                      @change="updateBlockLayout(block.id, { enabled: ($event.target as HTMLInputElement).checked })"
                    />
                    Enable Move / Resize
                  </label>

                  <input
                    class="text-input"
                    :value="block.mediaUrl || ''"
                    type="text"
                    :placeholder="block.kind === 'image' ? 'Image URL or upload file' : 'Video URL or upload file'"
                    @input="updateBlockMedia(block.id, ($event.target as HTMLInputElement).value)"
                  />
                  <input
                    class="file-input"
                    type="file"
                    :accept="block.kind === 'image' ? 'image/*' : 'video/*'"
                    @change="handleMediaUpload(block.id, $event)"
                  />
                </div>

                <div class="media-stage" :style="mediaStageStyle(block)" @click.stop="activateTransform(block.id)">
                  <img v-if="block.kind === 'image' && block.mediaUrl" :src="block.mediaUrl" alt="Report image" />
                  <video v-else-if="block.kind === 'video' && block.mediaUrl" :src="block.mediaUrl" controls></video>
                  <p v-else class="hint">{{ block.kind === 'image' ? 'No image selected.' : 'No video selected.' }}</p>
                </div>
              </template>

              <div
                v-if="!previewMode && !exporting && isMovableBlock(block) && block.layout?.enabled && activeTransformBlockId === block.id"
                class="transform-controls"
              >
                <button class="transform-btn" @mousedown.stop.prevent="startMove(block.id, $event)">Move</button>
                <span class="resize-handle" @mousedown.stop.prevent="startResize(block.id, $event)"></span>
              </div>

            </article>
          </div>
        </div>
      </section>
    </section>
  </main>
</template>

<style scoped>
.report-builder-page {
  height: calc(100vh - var(--nav-height));
  overflow: hidden;
  padding: 16px;
  background: #f5f7fb;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.topbar {
  margin-bottom: 12px;
}

.action-toolbar {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: flex-start;
  border: none;
  border-radius: 10px;
  background: #ffffff;
  padding: 12px;
  margin-bottom: 10px;
}

.left-tools,
.right-tools {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar-btn,
.primary-btn,
.secondary-btn,
.tool-btn {
  height: 36px;
  border: 1px solid #c7d3e3;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  padding: 0 12px;
  cursor: pointer;
}

.toolbar-btn.active {
  border-color: #0f4fa8;
  background: #0f4fa8;
  color: #ffffff;
}

.primary-btn {
  border-color: #0f4fa8;
  background: #0f4fa8;
  color: #ffffff;
}

.range-field {
  display: grid;
  grid-template-columns: auto 130px auto;
  gap: 8px;
  align-items: center;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  padding: 6px 8px;
  background: #ffffff;
}

.range-field span,
.range-field strong {
  font-size: 12px;
  color: #334155;
}

.range-field--zoom {
  grid-template-columns: auto minmax(110px, 160px) auto;
}

.icon-btn {
  height: 36px;
  border: 1px solid #0f4fa8;
  border-radius: 8px;
  background: #ffffff;
  color: #0f4fa8;
  padding: 0 10px;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

.icon-btn svg {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  fill: none;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.icon-btn:disabled,
.toolbar-btn:disabled,
.tool-btn:disabled,
.primary-btn:disabled,
.secondary-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.share-wrap {
  position: relative;
}

.share-panel {
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 5;
  width: 200px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: 0 8px 22px rgba(15, 23, 42, 0.12);
}

.message {
  color: #0f766e;
  font-size: 13px;
  margin: 0 0 10px;
}

.global-chart-controls {
  border: none;
  border-radius: 10px;
  background: #ffffff;
  padding: 12px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.global-chart-controls__header h3 {
  margin: 0;
  font-size: 15px;
  color: #1f2937;
}

.global-chart-controls__grid {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 10px;
  align-items: start;
}

.global-chart-controls__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.global-chart-controls__field span {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.content-grid {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 14px;
  flex: 1;
  min-height: 0;
}

.content-grid--preview {
  grid-template-columns: 1fr;
}

.chart-picker,
.report-preview {
  border: none;
  border-radius: 10px;
  background: #ffffff;
}

.chart-picker {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  position: sticky;
  top: 0;
  align-self: start;
  height: 100%;
  overflow-y: auto;
}

.chart-picker h2 {
  margin: 0;
  font-size: 16px;
}

.search-input,
.type-filter,
.text-input,
.section-input,
.title-input,
.subtitle-input,
.textarea-input,
.insert-row select {
  width: 100%;
  border: 1px solid #c7d3e3;
  border-radius: 8px;
  background: #ffffff;
  color: #1f2937;
  font-size: 14px;
  padding: 8px 10px;
}

.insert-controls {
  border: none;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-page-btn {
  width: 100%;
}

.insert-controls label {
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.insert-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.insert-icon-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.insert-icon-btn {
  width: 46px;
  height: 40px;
  border: 1px solid #c7d3e3;
  border-radius: 10px;
  background: #ffffff;
  color: #1f2937;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s ease, transform 0.15s ease, box-shadow 0.15s ease;
}

.insert-icon-btn:hover:not(:disabled) {
  border-color: #0f4fa8;
  box-shadow: 0 6px 14px rgba(15, 79, 168, 0.16);
  transform: translateY(-1px);
}

.insert-icon-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.insert-icon-btn__glyph {
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
}

.chart-item {
  border: none;
  border-radius: 8px;
  background: #ffffff;
  text-align: left;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  cursor: pointer;
}

.chart-card {
  display: block;
}

.chart-card__head {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  align-items: center;
  gap: 8px;
}

.chart-card__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.chart-type-icon {
  width: 26px;
  height: 26px;
  border-radius: 7px;
  border: 1px solid #d6deeb;
  background: #f8fafc;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: #334155;
  flex: 0 0 auto;
}

.chart-card__name {
  max-width: 176px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chart-item[draggable='true'] {
  cursor: grab;
}

.chart-item[draggable='true']:active {
  cursor: grabbing;
}

.chart-item small {
  color: #64748b;
}

.report-preview {
  min-height: 0;
  height: 100%;
  overflow: auto;
  padding: 14px;
}

.report-preview--clean .report-page,
.report-preview--clean .report-page * {
  border: none !important;
  box-shadow: none !important;
  filter: none !important;
  outline: none !important;
}

.report-preview--clean {
  background: #dbe1ea;
}

.report-preview--clean .pdf-surface {
  padding: 20px 0 28px;
}

.report-preview--clean .report-page + .report-page {
  margin-top: 28px;
}

.pdf-surface {
  width: max-content;
  margin: 0 auto;
}

.report-page {
  position: relative;
  min-height: 1000px;
  display: flex;
  flex-direction: column;
  border: none;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
}

.report-page + .report-page {
  margin-top: 16px;
}

.page-banner {
  border: none;
  border-radius: 8px;
  padding: 6px 10px;
  background: #f8fafc;
  color: #334155;
  font-size: 12px;
  font-weight: 600;
}

.report-block {
  position: relative;
  border: none;
  border-radius: 8px;
  background: #ffffff;
  padding: 12px;
}

.report-block--chart {
  overflow: visible;
}

.report-block--floating {
  border: none;
  box-shadow: 0 8px 18px rgba(15, 23, 42, 0.12);
  cursor: move;
}

.report-block--active {
  box-shadow: 0 0 0 2px rgba(15, 79, 168, 0.35), 0 8px 18px rgba(15, 23, 42, 0.16);
}

.delete-handle {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 999px;
  background: #dc2626;
  color: #ffffff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  z-index: 6;
  box-shadow: 0 6px 12px rgba(127, 29, 29, 0.24);
}

.delete-handle:hover {
  background: #b91c1c;
}

.chart-controls {
  border: none;
  border-radius: 8px;
  background: #f8fbff;
  padding: 10px;
  margin-bottom: 10px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.chart-controls--global {
  margin-bottom: 0;
}

.chart-controls label {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  font-size: 13px;
  color: #334155;
}

.chart-controls__checks {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.chart-controls__line {
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.1fr);
  gap: 10px;
  align-items: center;
}

.size-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.size-row label {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
}

.chart-stage {
  border: none;
  border-radius: 8px;
  background: #ffffff;
  overflow: visible;
  margin: 0 auto;
  position: relative;
  min-width: 0;
  min-height: 0;
}

.transform-controls {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.transform-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  height: 26px;
  border: none;
  border-radius: 6px;
  background: rgba(15, 79, 168, 0.9);
  color: #ffffff;
  padding: 0 10px;
  font-size: 12px;
  cursor: move;
  pointer-events: all;
}

.resize-handle {
  position: absolute;
  right: 8px;
  bottom: 8px;
  width: 14px;
  height: 14px;
  border-radius: 3px;
  background: rgba(15, 79, 168, 0.9);
  cursor: nwse-resize;
  pointer-events: all;
}

.section-title {
  margin: 0;
  font-size: var(--rb-section-font, 24px);
  color: #0f172a;
}

.title-input,
.subtitle-input,
.section-input {
  font-size: var(--rb-base-font, 14px);
  font-weight: 600;
}

.title-input {
  font-size: 30px;
  line-height: 1.2;
  font-weight: 800;
}

.subtitle-input {
  font-size: 20px;
  line-height: 1.3;
  font-weight: 700;
}

.section-input {
  font-size: 24px;
  line-height: 1.3;
  font-weight: 700;
}

.text-title {
  margin: 0;
  font-size: var(--rb-title-font, 32px);
  line-height: 1.25;
  color: #0f172a;
}

.text-subtitle {
  margin: 0;
  font-size: var(--rb-subtitle-font, 22px);
  color: #334155;
}

.textarea-input {
  font-size: var(--rb-base-font, 14px);
  line-height: 1.6;
  resize: vertical;
}

.textarea-input--paragraph {
  font-size: 14px;
  line-height: 1.75;
}

.textarea-input--notes {
  font-size: 13px;
  line-height: 1.6;
}

.textarea-input--source {
  font-size: 12px;
  line-height: 1.5;
}

.text-paragraph {
  margin: 0;
  font-size: var(--rb-base-font, 14px);
  line-height: 1.7;
  color: #1f2937;
  white-space: pre-wrap;
}

.text-source {
  margin: 0;
  line-height: 1.6;
  color: #64748b;
  font-size: var(--rb-source-font, 12px);
  white-space: pre-wrap;
}

.report-preview .report-block .title-input,
.report-preview .report-block .subtitle-input,
.report-preview .report-block .section-input,
.report-preview .report-block .textarea-input {
  appearance: none;
  -webkit-appearance: none;
  border: none;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  padding: 0;
  outline: none;
}

.report-preview .report-block .title-input:focus,
.report-preview .report-block .subtitle-input:focus,
.report-preview .report-block .section-input:focus,
.report-preview .report-block .textarea-input:focus {
  outline: none;
  box-shadow: none;
}

.report-preview .report-block--title,
.report-preview .report-block--subtitle,
.report-preview .report-block--section,
.report-preview .report-block--paragraph,
.report-preview .report-block--notes,
.report-preview .report-block--source {
  border: none;
  background: transparent;
  box-shadow: none;
  padding: 0;
}

.report-preview .report-block--active.report-block--title,
.report-preview .report-block--active.report-block--subtitle,
.report-preview .report-block--active.report-block--section,
.report-preview .report-block--active.report-block--paragraph,
.report-preview .report-block--active.report-block--notes,
.report-preview .report-block--active.report-block--source {
  box-shadow: none;
}

.media-controls {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 10px;
}

.file-input {
  font-size: 13px;
  color: #334155;
}

.media-stage {
  border: none;
  border-radius: 8px;
  background: #f8fafc;
  padding: 10px;
  min-height: 120px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.media-stage img,
.media-stage video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 6px;
}

.hint {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}

@media (max-width: 1100px) {
  .global-chart-controls__grid {
    grid-template-columns: 1fr;
  }

  .content-grid {
    grid-template-columns: 1fr;
    flex: none;
    min-height: auto;
  }

  .range-field {
    grid-template-columns: 1fr;
  }

  .size-row {
    grid-template-columns: 1fr;
  }

  .chart-controls__line {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 767px) {
  .report-builder-page {
    padding: 8px;
    overflow: auto;
    gap: 8px;
  }

  .action-toolbar {
    flex-direction: column;
  }

  .left-tools,
  .right-tools {
    width: 100%;
  }

  .icon-btn span {
    display: none;
  }

  .icon-btn {
    min-width: 36px;
    padding: 0 8px;
  }

  .pdf-surface {
    margin: 0;
  }

  .chart-controls__checks {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
}
</style>
