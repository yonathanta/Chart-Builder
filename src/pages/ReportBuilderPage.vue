<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useProjectStore } from '../stores/projectStore'
import chartService from '../services/chartService'
import reportService, { type ReportRecord } from '../services/reportService'

type ChartItem = {
  id: string
  name: string
  chartType: string
  status: string
}

const projectStore = useProjectStore()

const reportId = ref<string | null>(null)
const reportTitle = ref('New Report')
const metadataJson = ref('{\n  "author": "",\n  "notes": ""\n}')

const allCharts = ref<ChartItem[]>([])
const selectedChartIds = ref<string[]>([])
const reports = ref<ReportRecord[]>([])
const isLoading = ref(false)
const message = ref('')

const currentProjectId = computed(() => projectStore.currentProject?.id ?? '')

const approvedCharts = computed(() =>
  allCharts.value.filter((chart) => chart.status === 'Approved' || chart.status === 'Published')
)

const selectedCharts = computed(() =>
  selectedChartIds.value
    .map((id) => allCharts.value.find((chart) => chart.id === id))
    .filter((chart): chart is ChartItem => !!chart)
)

const canExportFinal = computed(() =>
  selectedCharts.value.length > 0 && selectedCharts.value.every((chart) => chart.status === 'Published')
)

function setMessage(text: string): void {
  message.value = text
  setTimeout(() => {
    if (message.value === text) {
      message.value = ''
    }
  }, 2500)
}

async function loadData(): Promise<void> {
  if (!currentProjectId.value) {
    allCharts.value = []
    reports.value = []
    return
  }

  isLoading.value = true
  try {
    const [chartsResponse, reportsResponse] = await Promise.all([
      chartService.getCharts(currentProjectId.value),
      reportService.getReports(currentProjectId.value),
    ])

    allCharts.value = Array.isArray(chartsResponse)
      ? chartsResponse.map((item) => ({
          id: String((item as any).id ?? (item as any).Id ?? ''),
          name: String((item as any).name ?? (item as any).Name ?? 'Untitled Chart'),
          chartType: String((item as any).chartType ?? (item as any).ChartType ?? 'unknown'),
          status: String((item as any).status ?? (item as any).Status ?? 'Draft'),
        }))
      : []

    reports.value = reportsResponse
  } catch (error) {
    console.error('Failed to load report builder data', error)
    setMessage('Failed to load report data.')
  } finally {
    isLoading.value = false
  }
}

function addChart(chartId: string): void {
  if (!selectedChartIds.value.includes(chartId)) {
    selectedChartIds.value.push(chartId)
  }
}

function removeChart(chartId: string): void {
  selectedChartIds.value = selectedChartIds.value.filter((id) => id !== chartId)
}

function onDragStart(event: DragEvent, index: number): void {
  if (!event.dataTransfer) {
    return
  }

  event.dataTransfer.setData('text/plain', String(index))
  event.dataTransfer.effectAllowed = 'move'
}

function onDrop(event: DragEvent, targetIndex: number): void {
  if (!event.dataTransfer) {
    return
  }

  const sourceIndex = Number(event.dataTransfer.getData('text/plain'))
  if (Number.isNaN(sourceIndex) || sourceIndex === targetIndex) {
    return
  }

  const current = [...selectedChartIds.value]
  const [moved] = current.splice(sourceIndex, 1)
  if (!moved) {
    return
  }

  current.splice(targetIndex, 0, moved)
  selectedChartIds.value = current
}

function buildLayoutJson(): string {
  return JSON.stringify({
    chartIds: selectedChartIds.value,
  })
}

async function saveReport(): Promise<void> {
  if (!currentProjectId.value) {
    setMessage('Select a project first.')
    return
  }

  if (!reportTitle.value.trim()) {
    setMessage('Report title is required.')
    return
  }

  const payload = {
    title: reportTitle.value.trim(),
    metadataJson: metadataJson.value,
    layoutJson: buildLayoutJson(),
    projectId: currentProjectId.value,
  }

  try {
    if (reportId.value) {
      const updated = await reportService.updateReport(reportId.value, payload)
      reportId.value = updated.id
    } else {
      const created = await reportService.createReport(payload)
      reportId.value = created.id
    }

    await loadData()
    setMessage('Report layout saved.')
  } catch (error) {
    console.error('Failed to save report', error)
    setMessage('Failed to save report.')
  }
}

function loadReport(report: ReportRecord): void {
  reportId.value = report.id
  reportTitle.value = report.title
  metadataJson.value = report.metadataJson

  try {
    const parsed = JSON.parse(report.layoutJson) as { chartIds?: string[] }
    selectedChartIds.value = Array.isArray(parsed.chartIds) ? parsed.chartIds : []
  } catch {
    selectedChartIds.value = []
  }
}

function createNewReport(): void {
  reportId.value = null
  reportTitle.value = 'New Report'
  metadataJson.value = '{\n  "author": "",\n  "notes": ""\n}'
  selectedChartIds.value = []
}

async function exportPdf(): Promise<void> {
  if (!canExportFinal.value) {
    setMessage('Only published charts are allowed in final report export.')
    return
  }

  const el = document.getElementById('report-preview-surface')
  if (!el) {
    return
  }

  const canvas = await html2canvas(el, {
    scale: 2,
    useCORS: true,
    logging: false,
  })

  const imgData = canvas.toDataURL('image/png')
  const pdf = new jsPDF('p', 'mm', 'a4')
  const width = pdf.internal.pageSize.getWidth()
  const props = pdf.getImageProperties(imgData)
  const height = (props.height * width) / props.width
  pdf.addImage(imgData, 'PNG', 0, 0, width, height)
  pdf.save(`${reportTitle.value || 'report'}.pdf`)
}

watch(currentProjectId, async () => {
  createNewReport()
  await loadData()
})

onMounted(async () => {
  await loadData()
})
</script>

<template>
  <main class="report-builder">
    <aside class="left-panel">
      <div class="panel-block">
        <h3>Report Details</h3>
        <input v-model="reportTitle" placeholder="Report title" class="input" />
        <textarea v-model="metadataJson" class="textarea" rows="6" placeholder="Metadata JSON"></textarea>
        <button class="btn btn--outline" @click="createNewReport">New Report</button>
        <button class="btn btn--primary" @click="saveReport">Save Layout</button>
        <button class="btn btn--primary" :disabled="!canExportFinal" @click="exportPdf">Export PDF</button>
        <p v-if="!canExportFinal" class="hint">Final export requires all selected charts to be Published.</p>
        <p v-if="message" class="msg">{{ message }}</p>
      </div>

      <div class="panel-block">
        <h3>Saved Reports</h3>
        <div class="list">
          <button v-for="item in reports" :key="item.id" class="list-item" @click="loadReport(item)">
            {{ item.title }}
          </button>
          <p v-if="reports.length === 0" class="hint">No saved reports.</p>
        </div>
      </div>

      <div class="panel-block">
        <h3>Approved Charts</h3>
        <div class="list">
          <button v-for="chart in approvedCharts" :key="chart.id" class="list-item" @click="addChart(chart.id)">
            {{ chart.name }} ({{ chart.status }})
          </button>
          <p v-if="approvedCharts.length === 0" class="hint">No approved charts available.</p>
        </div>
      </div>
    </aside>

    <section class="right-panel">
      <div v-if="isLoading" class="hint">Loading...</div>
      <div v-else id="report-preview-surface" class="preview">
        <h1>{{ reportTitle }}</h1>
        <pre class="meta">{{ metadataJson }}</pre>

        <h3>Charts (Drag to reorder)</h3>
        <ul class="selected-list">
          <li
            v-for="(chart, index) in selectedCharts"
            :key="chart.id"
            class="selected-item"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover.prevent
            @drop="onDrop($event, index)"
          >
            <div>
              <strong>{{ index + 1 }}. {{ chart.name }}</strong>
              <div class="hint">Type: {{ chart.chartType }} | Status: {{ chart.status }}</div>
            </div>
            <button class="btn btn--outline" @click="removeChart(chart.id)">Remove</button>
          </li>
        </ul>
      </div>
    </section>
  </main>
</template>

<style scoped>
.report-builder {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  height: calc(100vh - var(--nav-height));
  padding: 16px;
  background: #f8fafc;
}

.left-panel,
.right-panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  overflow: auto;
}

.left-panel {
  padding: 14px;
}

.panel-block {
  margin-bottom: 18px;
}

.panel-block h3 {
  margin: 0 0 8px;
}

.input,
.textarea {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px;
  margin-bottom: 8px;
}

.btn {
  height: 34px;
  border-radius: 8px;
  padding: 0 12px;
  cursor: pointer;
  margin-right: 8px;
  margin-bottom: 8px;
}

.btn--primary {
  border: 1px solid #2563eb;
  background: #2563eb;
  color: white;
}

.btn--outline {
  border: 1px solid #cbd5e1;
  background: white;
}

.btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.preview {
  padding: 20px;
}

.meta {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 10px;
  white-space: pre-wrap;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.list-item {
  text-align: left;
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
}

.selected-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.selected-item {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  background: #ffffff;
}

.hint {
  color: #64748b;
  font-size: 12px;
}

.msg {
  color: #0f766e;
  font-size: 13px;
}
</style>
