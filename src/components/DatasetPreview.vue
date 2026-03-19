<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import datasetService from '../services/datasetService'

const props = defineProps<{
  datasetId: string
}>()

const rows = ref<Array<Record<string, unknown>>>([])
const columns = ref<string[]>([])
const loading = ref(false)
const error = ref('')
const datasetName = ref('')

const previewRows = computed(() => rows.value.slice(0, 100))
const totalRows = computed(() => rows.value.length)

function normalizeRows(data: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(data)) {
    return data.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
  }

  if (typeof data === 'object' && data !== null) {
    const wrappedRows = (data as { rows?: unknown; data?: unknown }).rows
    if (Array.isArray(wrappedRows)) {
      return wrappedRows.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }

    const wrappedData = (data as { data?: unknown }).data
    if (Array.isArray(wrappedData)) {
      return wrappedData.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }
  }

  return []
}

async function loadDataset(): Promise<void> {
  if (!props.datasetId) {
    rows.value = []
    columns.value = []
    datasetName.value = ''
    error.value = ''
    return
  }

  loading.value = true
  error.value = ''

  try {
    const dataset = await datasetService.getDataset(props.datasetId)
    datasetName.value = dataset.name

    const parsed = JSON.parse(dataset.dataJson) as unknown
    const normalizedRows = normalizeRows(parsed)

    rows.value = normalizedRows
    columns.value = Object.keys(normalizedRows[0] ?? {})

    if (normalizedRows.length === 0) {
      error.value = 'Dataset has no previewable rows.'
    }
  } catch (err) {
    rows.value = []
    columns.value = []
    datasetName.value = ''
    error.value = err instanceof Error ? err.message : 'Failed to load dataset preview.'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.datasetId,
  async () => {
    await loadDataset()
  },
  { immediate: true }
)

defineExpose({
  reload: loadDataset,
})
</script>

<template>
  <section class="dataset-preview">
    <div class="dataset-preview__header">
      <div>
        <h3 class="dataset-preview__title">Dataset Preview</h3>
        <p v-if="datasetName" class="dataset-preview__subtitle">{{ datasetName }}</p>
      </div>
      <span v-if="totalRows > 0" class="dataset-preview__meta">
        Showing {{ previewRows.length }} of {{ totalRows }} rows
      </span>
    </div>

    <p v-if="loading" class="dataset-preview__hint">Loading dataset preview...</p>
    <p v-else-if="error" class="dataset-preview__error">{{ error }}</p>
    <p v-else-if="previewRows.length === 0" class="dataset-preview__hint">No rows available.</p>

    <div v-else class="dataset-preview__table-wrap">
      <table class="dataset-preview__table">
        <thead>
          <tr>
            <th>#</th>
            <th v-for="column in columns" :key="column">{{ column }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
            <td>{{ rowIndex + 1 }}</td>
            <td v-for="column in columns" :key="`${rowIndex}-${column}`">
              {{ row[column] }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.dataset-preview {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}

.dataset-preview__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 10px;
}

.dataset-preview__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.dataset-preview__subtitle {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.dataset-preview__meta,
.dataset-preview__hint,
.dataset-preview__error {
  font-size: 12px;
}

.dataset-preview__meta,
.dataset-preview__hint {
  color: #64748b;
}

.dataset-preview__error {
  color: #dc2626;
}

.dataset-preview__table-wrap {
  overflow: auto;
  max-height: 480px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.dataset-preview__table {
  width: 100%;
  border-collapse: collapse;
}

.dataset-preview__table th,
.dataset-preview__table td {
  padding: 8px;
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  vertical-align: top;
  font-size: 12px;
}

.dataset-preview__table th {
  position: sticky;
  top: 0;
  background: #f8fafc;
  color: #334155;
  z-index: 1;
}
</style>
