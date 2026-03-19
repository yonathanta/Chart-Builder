<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DatasetUploadPanel from '../components/DatasetUploadPanel.vue'
import DatasetPreview from '../components/DatasetPreview.vue'
import ManualDatasetEditor from '../components/ManualDatasetEditor.vue'
import datasetService, {
  type DatasetRecord,
} from '../services/datasetService'
import { useProjectStore } from '../stores/projectStore'

const router = useRouter()
const projectStore = useProjectStore()

const datasets = ref<DatasetRecord[]>([])
const loading = ref(false)
const saving = ref(false)
const message = ref('')
const selectedDatasetId = ref('')
const openedDataset = ref<DatasetRecord | null>(null)
const showUploadPanel = ref(false)
const showManualEditor = ref(false)
const editingDataset = ref<DatasetRecord | null>(null)
const GLOBAL_SELECTED_DATASET_KEY = 'selectedDatasetId'
const DATASET_SYNC_SIGNAL_KEY = 'chartBuilder:lastDatasetUpdate'

function getProjectDatasetStorageKey(projectId: string): string {
  return `chartBuilder:selectedDataset:${projectId}`
}

function persistDatasetSelection(projectId: string, dataset: DatasetRecord): void {
  if (!projectId || !dataset.id) {
    return
  }

  localStorage.setItem(getProjectDatasetStorageKey(projectId), dataset.id)
  localStorage.setItem(GLOBAL_SELECTED_DATASET_KEY, dataset.id)
  localStorage.setItem(
    DATASET_SYNC_SIGNAL_KEY,
    JSON.stringify({ projectId, datasetId: dataset.id, timestamp: Date.now() })
  )
}

const currentProjectId = computed(() => projectStore.currentProject?.id ?? '')

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
    return 'You are not allowed to manage datasets with this account role.'
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

function formatDate(value?: string): string {
  if (!value) {
    return '-'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }

  return date.toLocaleString()
}

function normalizeRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
  }

  if (typeof data === 'object' && data !== null) {
    const wrappedData = (data as { rows?: unknown; data?: unknown })
    if (Array.isArray(wrappedData.rows)) {
      return wrappedData.rows.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }
    if (Array.isArray(wrappedData.data)) {
      return wrappedData.data.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }
  }

  return []
}

function datasetDisplayType(sourceType: string): string {
  return sourceType.toLowerCase() === 'manual' ? 'Manual' : 'Uploaded'
}

function lastModified(dataset: DatasetRecord): string {
  const extended = dataset as DatasetRecord & { updatedAt?: string }
  return formatDate(extended.updatedAt || dataset.createdAt)
}

async function loadDatasets(): Promise<void> {
  const projectId = currentProjectId.value
  if (!projectId) {
    datasets.value = []
    selectedDatasetId.value = ''
    openedDataset.value = null
    return
  }

  loading.value = true
  try {
    datasets.value = await datasetService.getDatasetsByProject(projectId)

    const selectedStillExists = datasets.value.some((dataset) => dataset.id === selectedDatasetId.value)
    if (!selectedStillExists) {
      selectedDatasetId.value = datasets.value[0]?.id ?? ''
    }
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to load datasets.'))
  } finally {
    loading.value = false
  }
}

function handleUploadClick(): void {
  showUploadPanel.value = true
}

function handleUploadCancel(): void {
  showUploadPanel.value = false
}

function handleUploadSuccess(created: DatasetRecord): void {
  datasets.value = [created, ...datasets.value]
  selectedDatasetId.value = created.id
  persistDatasetSelection(currentProjectId.value, created)
  showUploadPanel.value = false
  setMessage('Dataset uploaded successfully.')
}

function handleUploadError(messageText: string): void {
  setMessage(messageText || 'Failed to upload dataset.')
}

function handleCreateManualDataset(): void {
  showUploadPanel.value = false
  editingDataset.value = null
  showManualEditor.value = true
}

async function handleOpenDataset(): Promise<void> {
  if (!selectedDatasetId.value) {
    return
  }

  try {
    openedDataset.value = await datasetService.getDataset(selectedDatasetId.value)
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to open dataset.'))
  }
}

function handleUseDataset(dataset: DatasetRecord): void {
  selectedDatasetId.value = dataset.id
  persistDatasetSelection(currentProjectId.value, dataset)
  setMessage(`Dataset selected: ${dataset.name}`)
}

async function handleEditDataset(dataset: DatasetRecord): Promise<void> {
  if (saving.value) {
    return
  }

  try {
    editingDataset.value = await datasetService.getDataset(dataset.id)
    showManualEditor.value = true
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to open dataset editor.'))
  }
}

async function handleDuplicateDataset(dataset: DatasetRecord): Promise<void> {
  if (saving.value || !currentProjectId.value) {
    return
  }

  try {
    const loaded = await datasetService.getDataset(dataset.id)
    const parsed = JSON.parse(loaded.dataJson) as unknown
    const rows = normalizeRows(parsed)

    const duplicateDataJson = JSON.stringify({
      ...(typeof parsed === 'object' && parsed !== null ? parsed : {}),
      id: `${loaded.id}-copy-${Date.now()}`,
      name: `${loaded.name} Copy`,
      rows,
      data: rows,
      lastModified: new Date().toISOString(),
    })

    const created = await datasetService.createDataset({
      projectId: currentProjectId.value,
      name: `${loaded.name} Copy`,
      description: loaded.description,
      dataJson: duplicateDataJson,
      sourceType: loaded.sourceType || 'manual',
    })

    datasets.value = [created, ...datasets.value]
    setMessage('Dataset duplicated successfully.')
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to duplicate dataset.'))
  }
}

function handleManualEditorClose(): void {
  showManualEditor.value = false
  editingDataset.value = null
}

function handleManualEditorSaved(payload: {
  dataset: DatasetRecord
  createChartRequested: boolean
  suggestedChartType?: string
  suggestedEncoding?: {
    category?: string
    value?: string
    series?: string
  }
}): void {
  const saved = payload.dataset
  const existingIndex = datasets.value.findIndex((item) => item.id === saved.id)

  if (existingIndex >= 0) {
    datasets.value.splice(existingIndex, 1, saved)
  } else {
    datasets.value = [saved, ...datasets.value]
  }

  selectedDatasetId.value = saved.id
  persistDatasetSelection(currentProjectId.value, saved)

  if (payload.createChartRequested) {
    const query: Record<string, string> = {
      datasetId: saved.id,
      projectId: currentProjectId.value,
      autoload: '1',
    }

    if (payload.suggestedChartType) {
      query.chartType = payload.suggestedChartType
    }

    if (payload.suggestedEncoding?.category) {
      query.xField = payload.suggestedEncoding.category
    }

    if (payload.suggestedEncoding?.value) {
      query.yField = payload.suggestedEncoding.value
    }

    if (payload.suggestedEncoding?.series) {
      query.seriesField = payload.suggestedEncoding.series
    }

    handleManualEditorClose()
    router.push({ path: '/charts', query })
    return
  }

  setMessage(editingDataset.value ? 'Dataset updated successfully.' : 'Dataset created successfully.')
  handleManualEditorClose()
}

function handleManualEditorError(messageText: string): void {
  setMessage(messageText || 'Failed to save manual dataset.')
}

async function handleDeleteDataset(dataset: DatasetRecord): Promise<void> {
  const confirmed = window.confirm(`Delete dataset "${dataset.name}"?`)
  if (!confirmed) {
    return
  }

  try {
    await datasetService.deleteDataset(dataset.id)
    datasets.value = datasets.value.filter((item) => item.id !== dataset.id)

    if (selectedDatasetId.value === dataset.id) {
      selectedDatasetId.value = datasets.value[0]?.id ?? ''
    }

    if (openedDataset.value?.id === dataset.id) {
      openedDataset.value = null
    }

    setMessage('Dataset deleted.')
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to delete dataset.'))
  }
}

function goToCharts(): void {
  router.push('/charts')
}

onMounted(async () => {
  await loadDatasets()
})

watch(
  () => currentProjectId.value,
  async () => {
    await loadDatasets()
  }
)
</script>

<template>
  <main class="datasets-page">
    <section class="toolbar-panel">
      <h2>Dataset Library</h2>
      <p class="hint">Manage datasets for the selected project.</p>

      <div class="toolbar-actions">
        <button :disabled="!currentProjectId" @click="handleUploadClick">
          Upload Dataset
        </button>
        <button :disabled="saving || !currentProjectId" @click="handleCreateManualDataset">
          Create Dataset Manually
        </button>
        <button :disabled="!selectedDatasetId" @click="handleOpenDataset">
          Open Dataset
        </button>
      </div>

      <DatasetUploadPanel
        v-if="showUploadPanel && currentProjectId"
        :project-id="currentProjectId"
        @uploaded="handleUploadSuccess"
        @cancel="handleUploadCancel"
        @error="handleUploadError"
        @open-manual-editor="handleCreateManualDataset"
      />

      <p v-if="message" class="message">{{ message }}</p>
    </section>

    <section class="table-panel">
      <p v-if="!currentProjectId" class="hint">Select a project first.</p>
      <p v-else-if="loading" class="hint">Loading datasets...</p>
      <p v-else-if="datasets.length === 0" class="hint">No datasets found for this project.</p>

      <table v-else class="datasets-table">
        <thead>
          <tr>
            <th>Dataset Name</th>
            <th>Description</th>
            <th>Type</th>
            <th>Last Modified</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="dataset in datasets"
            :key="dataset.id"
            :class="{ selected: selectedDatasetId === dataset.id }"
          >
            <td>{{ dataset.name }}</td>
            <td>{{ dataset.description || '-' }}</td>
            <td>{{ datasetDisplayType(dataset.sourceType) }}</td>
            <td>{{ lastModified(dataset) }}</td>
            <td>
              <div class="row-actions">
                <button class="small" @click="handleUseDataset(dataset)">Use</button>
                <button class="small" @click="handleEditDataset(dataset)">Edit</button>
                <button class="small" @click="handleDuplicateDataset(dataset)">Duplicate</button>
                <button class="small danger" @click="handleDeleteDataset(dataset)">Delete</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div v-if="openedDataset" class="opened-panel">
        <div class="opened-title">Opened Dataset: {{ openedDataset.name }}</div>
        <DatasetPreview :dataset-id="openedDataset.id" />
        <button class="small" @click="goToCharts">Use in Charts</button>
      </div>

      <ManualDatasetEditor
        v-if="showManualEditor && currentProjectId"
        :project-id="currentProjectId"
        :dataset="editingDataset"
        @close="handleManualEditorClose"
        @saved="handleManualEditorSaved"
        @error="handleManualEditorError"
      />
    </section>
  </main>
</template>

<style scoped>
.datasets-page {
  padding: 16px;
  display: grid;
  gap: 14px;
  background: #f8fafc;
  min-height: calc(100vh - var(--nav-height));
}

.toolbar-panel,
.table-panel {
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

.toolbar-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
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

button.small {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

button.danger {
  border-color: #dc2626;
  background: #dc2626;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.datasets-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.datasets-table th,
.datasets-table td {
  border: 1px solid #e2e8f0;
  padding: 8px;
  text-align: left;
  vertical-align: middle;
}

.datasets-table th {
  background: #f8fafc;
  color: #334155;
}

.datasets-table tr.selected {
  background: #eff6ff;
}

.row-actions {
  display: flex;
  gap: 6px;
}

.opened-panel {
  margin-top: 12px;
  display: grid;
  gap: 10px;
}

.opened-title {
  font-weight: 600;
}
</style>
