<script setup lang="ts">
import { computed, ref } from 'vue'
import * as XLSX from 'xlsx'
import datasetService, { type DatasetRecord } from '../services/datasetService'

const props = defineProps<{
  projectId: string
}>()

const emit = defineEmits<{
  (e: 'uploaded', dataset: DatasetRecord): void
  (e: 'cancel'): void
  (e: 'error', message: string): void
  (e: 'open-manual-editor'): void
}>()

const file = ref<File | null>(null)
const loadingPreview = ref(false)
const saving = ref(false)
const previewRows = ref<Array<Record<string, unknown>>>([])
const previewColumns = ref<string[]>([])
const statusMessage = ref('')
const datasetName = ref('')
const description = ref('')

const canSave = computed(() => {
  return !!props.projectId && !!file.value && previewRows.value.length > 0 && datasetName.value.trim().length > 0 && !saving.value
})

const displayedRows = computed(() => previewRows.value.slice(0, 12))

function getSourceType(fileName: string): string {
  return fileName.toLowerCase().endsWith('.csv') ? 'csv' : 'excel'
}

function ensureSupported(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return lower.endsWith('.csv') || lower.endsWith('.xlsx')
}

async function parseFileForPreview(selectedFile: File): Promise<void> {
  loadingPreview.value = true
  try {
    const arrayBuffer = await selectedFile.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { type: 'array' })
    const firstSheetName = workbook.SheetNames[0]

    if (!firstSheetName) {
      throw new Error('The selected file does not contain any sheets.')
    }

    const firstSheet = workbook.Sheets[firstSheetName]
    if (!firstSheet) {
      throw new Error('Failed to read worksheet data.')
    }

    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' }) as Array<Record<string, unknown>>
    if (rows.length === 0) {
      throw new Error('The selected file has no rows to preview.')
    }

    previewRows.value = rows
    previewColumns.value = Object.keys(rows[0] ?? {})

    if (!datasetName.value) {
      datasetName.value = selectedFile.name.replace(/\.[^/.]+$/, '') || 'Uploaded Dataset'
    }

    statusMessage.value = `Preview loaded: ${rows.length} rows.`
  } finally {
    loadingPreview.value = false
  }
}

async function onFileChange(event: Event): Promise<void> {
  const input = event.target as HTMLInputElement
  const selectedFile = input.files?.[0]

  previewRows.value = []
  previewColumns.value = []

  if (!selectedFile) {
    file.value = null
    return
  }

  if (!ensureSupported(selectedFile.name)) {
    file.value = null
    statusMessage.value = 'Only CSV and .xlsx files are supported.'
    emit('error', statusMessage.value)
    input.value = ''
    return
  }

  file.value = selectedFile

  try {
    await parseFileForPreview(selectedFile)
  } catch (error) {
    file.value = null
    const message = error instanceof Error ? error.message : 'Failed to parse file for preview.'
    statusMessage.value = message
    emit('error', message)
  }
}

async function saveUpload(): Promise<void> {
  if (!file.value || !canSave.value) {
    return
  }

  saving.value = true
  try {
    const formData = new FormData()
    formData.append('projectId', props.projectId)
    formData.append('name', datasetName.value.trim())
    formData.append('description', description.value.trim())
    formData.append('sourceType', getSourceType(file.value.name))
    formData.append('file', file.value)

    const created = await datasetService.uploadDataset(formData)
    emit('uploaded', created)

    statusMessage.value = 'Dataset uploaded successfully.'
    file.value = null
    previewRows.value = []
    previewColumns.value = []
    datasetName.value = ''
    description.value = ''
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to upload dataset.'
    emit('error', message)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="upload-panel">
    <div class="upload-header">
      <h3>Upload Dataset</h3>
      <button class="ghost" @click="$emit('cancel')">Close</button>
    </div>

    <div class="form-grid">
      <input
        type="file"
        accept=".csv,.xlsx"
        @change="onFileChange"
      />

      <input
        v-model="datasetName"
        type="text"
        placeholder="Dataset name"
      />

      <input
        v-model="description"
        type="text"
        placeholder="Description (optional)"
      />
    </div>

    <p v-if="statusMessage" class="status">{{ statusMessage }}</p>
    <p v-if="loadingPreview" class="hint">Generating preview...</p>

    <div v-if="previewRows.length > 0" class="preview-wrap">
      <p class="hint">Preview (showing first {{ displayedRows.length }} of {{ previewRows.length }} rows)</p>
      <table class="preview-table">
        <thead>
          <tr>
            <th v-for="column in previewColumns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in displayedRows" :key="rowIndex">
            <td v-for="column in previewColumns" :key="`${rowIndex}-${column}`">
              {{ row[column] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="actions">
      <button class="ghost" @click="$emit('open-manual-editor')">
        Create Dataset Manually
      </button>
      <button :disabled="!canSave" @click="saveUpload">
        {{ saving ? 'Saving...' : 'Save Dataset' }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.upload-panel {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
  margin-top: 10px;
}

.upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

h3 {
  margin: 0;
}

.form-grid {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr 1fr 1fr;
}

input {
  height: 36px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
}

.status,
.hint {
  margin-top: 8px;
  font-size: 12px;
  color: #64748b;
}

.preview-wrap {
  margin-top: 10px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
}

.preview-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 8px;
}

.preview-table th,
.preview-table td {
  border: 1px solid #e2e8f0;
  padding: 6px;
  text-align: left;
  font-size: 12px;
}

.actions {
  margin-top: 10px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

button {
  height: 36px;
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

button.ghost {
  border-color: #cbd5e1;
  background: #fff;
  color: #334155;
}
</style>
