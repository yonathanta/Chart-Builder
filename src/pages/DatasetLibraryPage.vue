<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import DatasetUploadPanel from '../components/DatasetUploadPanel.vue'
import DatasetPreview from '../components/DatasetPreview.vue'
import datasetService, {
  type DatasetRecord,
  type UpdateDatasetPayload,
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

async function handleCreateManualDataset(): Promise<void> {
  const projectId = currentProjectId.value
  if (!projectId || saving.value) {
    return
  }

  const name = window.prompt('Dataset name')?.trim()
  if (!name) {
    return
  }

  const description = window.prompt('Description (optional)')?.trim()
  const dataJson = window.prompt('Dataset JSON (e.g. [{"x":1,"y":2}])', '[]')?.trim()

  if (!dataJson) {
    return
  }

  saving.value = true
  try {
    const created = await datasetService.createDataset({
      name,
      description: description || undefined,
      projectId,
      dataJson,
      sourceType: 'manual',
    })

    datasets.value = [created, ...datasets.value]
    selectedDatasetId.value = created.id
    setMessage('Dataset created successfully.')
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to create dataset.'))
  } finally {
    saving.value = false
  }
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
    const loaded = await datasetService.getDataset(dataset.id)
    const name = window.prompt('Dataset name', loaded.name)?.trim()
    if (!name) {
      return
    }

    const description = window.prompt('Description (optional)', loaded.description ?? '')?.trim()
    const sourceType = window.prompt('Source type', loaded.sourceType)?.trim()
    if (!sourceType) {
      return
    }

    const updatePayload: UpdateDatasetPayload = {
      name,
      description: description || undefined,
      dataJson: loaded.dataJson,
      sourceType,
    }

    saving.value = true
    const updated = await datasetService.updateDataset(dataset.id, updatePayload)
    datasets.value = datasets.value.map((item) => (item.id === updated.id ? updated : item))

    if (openedDataset.value?.id === updated.id) {
      openedDataset.value = { ...openedDataset.value, ...updated }
    }

    setMessage('Dataset updated successfully.')
  } catch (error) {
    setMessage(getErrorMessage(error, 'Failed to update dataset.'))
  } finally {
    saving.value = false
  }
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
            <th>Source Type</th>
            <th>Created Date</th>
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
            <td>{{ dataset.sourceType }}</td>
            <td>{{ formatDate(dataset.createdAt) }}</td>
            <td>
              <div class="row-actions">
                <button class="small" @click="handleUseDataset(dataset)">Use</button>
                <button class="small" @click="handleEditDataset(dataset)">Edit</button>
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
