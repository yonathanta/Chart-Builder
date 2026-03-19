<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import datasetService, { type DatasetRecord } from '../services/datasetService'

type ColumnType = 'category' | 'number' | 'date'

type ManualColumn = {
  id: string
  name: string
  type: ColumnType
}

type SavedPayload = {
  dataset: DatasetRecord
  createChartRequested: boolean
  suggestedChartType: string
  suggestedEncoding: {
    category?: string
    value?: string
    series?: string
  }
}

const props = defineProps<{
  projectId: string
  dataset?: DatasetRecord | null
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved', payload: SavedPayload): void
  (e: 'error', message: string): void
}>()

const COLUMN_TYPES: Array<{ label: string; value: ColumnType }> = [
  { label: 'Category', value: 'category' },
  { label: 'Number', value: 'number' },
  { label: 'Date', value: 'date' },
]

const datasetName = ref('')
const description = ref('')
const source = ref('')
const columns = ref<ManualColumn[]>([])
const rows = ref<string[][]>([])
const saveBusy = ref(false)
const validationMessage = ref('')
const pasteHint = ref('')
const bulkPasteText = ref('')
const tableViewportRef = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const rowHeight = 34
const visibleBuffer = 18
const invalidCells = ref<Set<string>>(new Set())

const isEditing = computed(() => !!props.dataset)
const editorTitle = computed(() => (isEditing.value ? 'Edit Dataset Manually' : 'Create Dataset Manually'))

const totalRows = computed(() => rows.value.length)
const totalCols = computed(() => columns.value.length)

const renderVirtual = computed(() => rows.value.length > 600)

const viewportHeight = computed(() => tableViewportRef.value?.clientHeight ?? 420)
const visibleCount = computed(() => Math.max(Math.ceil(viewportHeight.value / rowHeight) + 4, visibleBuffer))
const startIndex = computed(() => {
  if (!renderVirtual.value) {
    return 0
  }
  return Math.max(Math.floor(scrollTop.value / rowHeight) - 2, 0)
})
const endIndex = computed(() => {
  if (!renderVirtual.value) {
    return rows.value.length
  }
  return Math.min(startIndex.value + visibleCount.value, rows.value.length)
})
const visibleRows = computed(() => rows.value.slice(startIndex.value, endIndex.value))
const topSpacer = computed(() => (renderVirtual.value ? startIndex.value * rowHeight : 0))
const bottomSpacer = computed(() => (renderVirtual.value ? Math.max((rows.value.length - endIndex.value) * rowHeight, 0) : 0))

const canSave = computed(() => {
  return !saveBusy.value && !!props.projectId && datasetName.value.trim().length > 0 && columns.value.length > 0
})

function uid(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`
}

function toColumnType(value: unknown): ColumnType {
  if (value === 'number' || value === 'date' || value === 'category') {
    return value
  }
  return 'category'
}

function normalizeRows(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) {
    return payload.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
  }

  if (typeof payload === 'object' && payload !== null) {
    const obj = payload as { data?: unknown; rows?: unknown }
    if (Array.isArray(obj.rows)) {
      return obj.rows.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }

    if (Array.isArray(obj.data)) {
      return obj.data.filter((item) => typeof item === 'object' && item !== null) as Array<Record<string, unknown>>
    }
  }

  return []
}

function detectType(values: string[]): ColumnType {
  const nonEmpty = values.map((value) => value.trim()).filter((value) => value.length > 0)
  if (nonEmpty.length === 0) {
    return 'category'
  }

  const numericRatio = nonEmpty.filter((value) => Number.isFinite(Number(value))).length / nonEmpty.length
  if (numericRatio >= 0.9) {
    return 'number'
  }

  const dateRatio = nonEmpty.filter((value) => !Number.isNaN(Date.parse(value))).length / nonEmpty.length
  if (dateRatio >= 0.8) {
    return 'date'
  }

  return 'category'
}

function resetTable(colCount = 2, rowCount = 6): void {
  columns.value = Array.from({ length: colCount }, (_, index) => ({
    id: uid('col'),
    name: `Column ${index + 1}`,
    type: 'category',
  }))

  rows.value = Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => ''))
}

function ensureRowLength(row: string[]): string[] {
  if (row.length < columns.value.length) {
    return [...row, ...Array.from({ length: columns.value.length - row.length }, () => '')]
  }
  return row.slice(0, columns.value.length)
}

function initializeFromDataset(): void {
  validationMessage.value = ''
  invalidCells.value = new Set()

  if (!props.dataset) {
    datasetName.value = ''
    description.value = ''
    source.value = ''
    resetTable()
    return
  }

  datasetName.value = props.dataset.name ?? ''
  description.value = props.dataset.description ?? ''

  try {
    const parsed = JSON.parse(props.dataset.dataJson) as unknown
    const objectMeta = typeof parsed === 'object' && parsed !== null ? parsed as { columns?: unknown; source?: unknown; description?: unknown } : null
    const parsedRows = normalizeRows(parsed)

    const parsedColumns = Array.isArray(objectMeta?.columns)
      ? objectMeta?.columns
      : []

    const normalizedColumns: ManualColumn[] = Array.isArray(parsedColumns) && parsedColumns.length > 0
      ? (parsedColumns as Array<{ name?: unknown; type?: unknown }>).map((column, index) => ({
          id: uid('col'),
          name: typeof column?.name === 'string' && column.name.trim().length > 0 ? column.name.trim() : `Column ${index + 1}`,
          type: toColumnType(column?.type),
        }))
      : Object.keys(parsedRows[0] ?? {}).map((key, index) => ({
          id: uid('col'),
          name: key || `Column ${index + 1}`,
          type: detectType(parsedRows.map((row) => String(row[key] ?? ''))),
        }))

    columns.value = normalizedColumns.length > 0
      ? normalizedColumns
      : [
          { id: uid('col'), name: 'Column 1', type: 'category' },
          { id: uid('col'), name: 'Column 2', type: 'number' },
        ]

    rows.value = parsedRows.length > 0
      ? parsedRows.map((row) => columns.value.map((column) => String(row[column.name] ?? '')))
      : Array.from({ length: 6 }, () => Array.from({ length: columns.value.length }, () => ''))

    source.value = typeof objectMeta?.source === 'string' ? objectMeta.source : ''
    if (!source.value && typeof objectMeta?.description === 'string') {
      source.value = objectMeta.description
    }

    detectAllColumnTypes()
  } catch {
    emit('error', 'Failed to parse dataset content for manual editing.')
    resetTable()
  }
}

watch(
  () => props.dataset,
  async () => {
    initializeFromDataset()
    await nextTick()
    tableViewportRef.value?.scrollTo({ top: 0 })
  },
  { immediate: true }
)

function onScroll(): void {
  scrollTop.value = tableViewportRef.value?.scrollTop ?? 0
}

function addRow(atIndex?: number): void {
  const index = typeof atIndex === 'number' ? atIndex : rows.value.length
  const row = Array.from({ length: columns.value.length }, () => '')
  rows.value.splice(Math.max(0, Math.min(index, rows.value.length)), 0, row)
}

function removeRow(index: number): void {
  if (rows.value.length <= 1) {
    rows.value[0] = Array.from({ length: columns.value.length }, () => '')
    return
  }
  rows.value.splice(index, 1)
}

function addColumn(): void {
  const nextIndex = columns.value.length + 1
  columns.value.push({ id: uid('col'), name: `Column ${nextIndex}`, type: 'category' })
  rows.value = rows.value.map((row) => [...row, ''])
}

function removeColumn(index: number): void {
  if (columns.value.length <= 1) {
    return
  }
  columns.value.splice(index, 1)
  rows.value = rows.value.map((row) => row.filter((_, colIndex) => colIndex !== index))
}

function renameColumn(index: number, nextName: string): void {
  const target = columns.value[index]
  if (!target) {
    return
  }

  const clean = nextName.trim()
  if (!clean) {
    target.name = `Column ${index + 1}`
    return
  }
  target.name = clean
}

function updateCell(rowIndex: number, colIndex: number, value: string): void {
  const row = ensureRowLength(rows.value[rowIndex] ?? [])
  row[colIndex] = value
  rows.value[rowIndex] = row
}

function selectNextCell(currentRow: number, currentCol: number, backwards = false): void {
  const maxRow = rows.value.length - 1
  const maxCol = columns.value.length - 1

  let nextRow = currentRow
  let nextCol = currentCol

  if (backwards) {
    if (currentCol > 0) {
      nextCol -= 1
    } else if (currentRow > 0) {
      nextRow -= 1
      nextCol = maxCol
    }
  } else if (currentCol < maxCol) {
    nextCol += 1
  } else {
    nextRow = Math.min(currentRow + 1, maxRow)
    nextCol = 0
  }

  const selector = `[data-cell="${nextRow}-${nextCol}"]`
  const target = document.querySelector<HTMLInputElement>(selector)
  target?.focus()
  target?.select()
}

function handleCellKeydown(event: KeyboardEvent, rowIndex: number, colIndex: number): void {
  if (event.key === 'Enter') {
    event.preventDefault()
    selectNextCell(rowIndex, colIndex)
    return
  }

  if (event.key === 'Tab') {
    event.preventDefault()
    selectNextCell(rowIndex, colIndex, event.shiftKey)
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    const nextRow = Math.min(rowIndex + 1, rows.value.length - 1)
    const target = document.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-${colIndex}"]`)
    target?.focus()
    target?.select()
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault()
    const nextRow = Math.max(rowIndex - 1, 0)
    const target = document.querySelector<HTMLInputElement>(`[data-cell="${nextRow}-${colIndex}"]`)
    target?.focus()
    target?.select()
  }
}

function handlePaste(event: ClipboardEvent, rowIndex: number, colIndex: number): void {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) {
    return
  }

  event.preventDefault()

  applyPastedText(text, rowIndex, colIndex)
}

function parseClipboardText(text: string): string[][] {
  return text
    .replace(/\r/g, '')
    .split('\n')
    .filter((line) => line.length > 0)
    .map((line) => line.split('\t'))
}

function applyPastedText(text: string, rowIndex: number, colIndex: number): void {
  const rowChunks = parseClipboardText(text)

  if (rowChunks.length === 0) {
    return
  }

  pasteHint.value = ''

  const requiredRows = rowIndex + rowChunks.length
  while (rows.value.length < requiredRows) {
    addRow()
  }

  let requiredCols = columns.value.length
  for (const chunk of rowChunks) {
    requiredCols = Math.max(requiredCols, colIndex + chunk.length)
  }

  while (columns.value.length < requiredCols) {
    addColumn()
  }

  rowChunks.forEach((chunk, chunkRowIndex) => {
    const targetRowIndex = rowIndex + chunkRowIndex
    const row = ensureRowLength(rows.value[targetRowIndex] ?? [])

    chunk.forEach((cellValue, chunkColIndex) => {
      row[colIndex + chunkColIndex] = cellValue
    })

    rows.value[targetRowIndex] = row
  })

  detectAllColumnTypes()
}

function handleBulkPaste(event: ClipboardEvent): void {
  const text = event.clipboardData?.getData('text/plain') ?? ''
  if (!text) {
    return
  }

  event.preventDefault()
  bulkPasteText.value = text
  applyPastedText(text, 0, 0)
  pasteHint.value = 'Excel data pasted into table.'
}

async function pasteFromClipboard(): Promise<void> {
  try {
    const text = await navigator.clipboard.readText()
    if (!text.trim()) {
      pasteHint.value = 'Clipboard is empty.'
      return
    }

    bulkPasteText.value = text
    applyPastedText(text, 0, 0)
    pasteHint.value = 'Excel data pasted from clipboard.'
  } catch {
    pasteHint.value = 'Clipboard access blocked. Use Ctrl+V in the paste box.'
  }
}

function detectAllColumnTypes(): void {
  columns.value = columns.value.map((column, colIndex) => {
    const values = rows.value.map((row) => row[colIndex] ?? '')
    return {
      ...column,
      type: detectType(values),
    }
  })
}

function validate(): boolean {
  invalidCells.value = new Set()
  validationMessage.value = ''

  if (!datasetName.value.trim()) {
    validationMessage.value = 'Dataset name is required.'
    return false
  }

  if (columns.value.length === 0) {
    validationMessage.value = 'At least one column is required.'
    return false
  }

  const hasAnyValue = rows.value.some((row) => row.some((cell) => String(cell ?? '').trim().length > 0))
  if (!hasAnyValue) {
    validationMessage.value = 'Dataset must contain at least one value.'
    return false
  }

  columns.value.forEach((column, colIndex) => {
    if (column.type !== 'number') {
      return
    }

    rows.value.forEach((row, rowIndex) => {
      const raw = String(row[colIndex] ?? '').trim()
      if (!raw) {
        return
      }

      if (!Number.isFinite(Number(raw))) {
        invalidCells.value.add(`${rowIndex}-${colIndex}`)
      }
    })
  })

  if (invalidCells.value.size > 0) {
    validationMessage.value = 'Numeric columns contain invalid values. Please fix highlighted cells.'
    return false
  }

  return true
}

function buildRowsForSave(): Array<Record<string, unknown>> {
  return rows.value
    .map((row) => row.map((cell) => String(cell ?? '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))
    .map((row) => {
      const output: Record<string, unknown> = {}
      columns.value.forEach((column, colIndex) => {
        const raw = row[colIndex] ?? ''
        if (column.type === 'number') {
          output[column.name] = raw.length > 0 ? Number(raw) : null
          return
        }

        output[column.name] = raw
      })
      return output
    })
}

function suggestBinding(): { chartType: string; category?: string; value?: string; series?: string } {
  const categoryCol = columns.value.find((column) => column.type === 'category')
  const dateCol = columns.value.find((column) => column.type === 'date')
  const numberCol = columns.value.find((column) => column.type === 'number')

  if (dateCol && numberCol) {
    return {
      chartType: 'line',
      category: dateCol.name,
      value: numberCol.name,
    }
  }

  if (categoryCol && numberCol) {
    return {
      chartType: 'bar',
      category: categoryCol.name,
      value: numberCol.name,
    }
  }

  return {
    chartType: 'bar',
    category: columns.value[0]?.name,
    value: columns.value[1]?.name ?? columns.value[0]?.name,
  }
}

async function saveDataset(andCreateChart = false): Promise<void> {
  if (!validate()) {
    return
  }

  saveBusy.value = true
  try {
    const normalizedRows = buildRowsForSave()
    const columnsPayload = columns.value.map((column) => ({ name: column.name, type: column.type }))

    const payloadJson = JSON.stringify({
      id: props.dataset?.id ?? uid('manual-dataset'),
      name: datasetName.value.trim(),
      description: description.value.trim() || undefined,
      source: source.value.trim() || undefined,
      columns: columnsPayload,
      rows: normalizedRows,
      data: normalizedRows,
      lastModified: new Date().toISOString(),
    })

    const result = props.dataset
      ? await datasetService.updateDataset(props.dataset.id, {
          name: datasetName.value.trim(),
          description: description.value.trim() || undefined,
          dataJson: payloadJson,
          sourceType: 'manual',
        })
      : await datasetService.createDataset({
          projectId: props.projectId,
          name: datasetName.value.trim(),
          description: description.value.trim() || undefined,
          dataJson: payloadJson,
          sourceType: 'manual',
        })

    const suggestion = suggestBinding()
    emit('saved', {
      dataset: result,
      createChartRequested: andCreateChart,
      suggestedChartType: suggestion.chartType,
      suggestedEncoding: {
        category: suggestion.category,
        value: suggestion.value,
        series: suggestion.series,
      },
    })

    if (!andCreateChart) {
      emit('close')
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save dataset.'
    emit('error', message)
  } finally {
    saveBusy.value = false
  }
}

function closeEditor(): void {
  emit('close')
}

function isInvalidCell(rowIndex: number, colIndex: number): boolean {
  return invalidCells.value.has(`${rowIndex}-${colIndex}`)
}

onBeforeUnmount(() => {
  invalidCells.value = new Set()
})
</script>

<template>
  <div class="manual-editor-overlay" @click.self="closeEditor">
    <section class="manual-editor">
      <header class="manual-editor__header">
        <div>
          <h2>{{ editorTitle }}</h2>
          <p class="hint">Spreadsheet editor with paste support. Use Tab and Enter to navigate cells.</p>
        </div>
        <button class="ghost" @click="closeEditor">Close</button>
      </header>

      <div class="meta-grid">
        <label>
          <span>Dataset Name *</span>
          <input v-model="datasetName" type="text" placeholder="e.g. Population by Country" />
        </label>
        <label>
          <span>Description</span>
          <input v-model="description" type="text" placeholder="Optional description" />
        </label>
        <label>
          <span>Source</span>
          <input v-model="source" type="text" placeholder="Optional source" />
        </label>
      </div>

      <div class="sheet-toolbar">
        <div class="left-actions">
          <button class="small" @click="addRow()">+ Row</button>
          <button class="small" @click="addColumn()">+ Column</button>
          <button class="small ghost" @click="detectAllColumnTypes">Auto Detect Types</button>
          <button class="small ghost" @click="pasteFromClipboard">Paste from Clipboard</button>
        </div>
        <div class="sheet-stats">Rows: {{ totalRows }} | Columns: {{ totalCols }}</div>
      </div>

      <div class="paste-box-wrap">
        <label for="bulk-paste-box">Paste from Excel (Ctrl+V)</label>
        <textarea
          id="bulk-paste-box"
          v-model="bulkPasteText"
          class="paste-box"
          placeholder="Copy cells in Excel and paste here to fill the table"
          @paste="handleBulkPaste"
        ></textarea>
        <p v-if="pasteHint" class="hint">{{ pasteHint }}</p>
      </div>

      <div ref="tableViewportRef" class="sheet-wrap" @scroll="onScroll">
        <table class="sheet-table">
          <thead>
            <tr>
              <th class="row-number">#</th>
              <th v-for="(column, colIndex) in columns" :key="column.id">
                <div class="column-head">
                  <input
                    class="column-name"
                    :value="column.name"
                    @input="renameColumn(colIndex, ($event.target as HTMLInputElement).value)"
                  />
                  <select v-model="column.type">
                    <option v-for="type in COLUMN_TYPES" :key="type.value" :value="type.value">
                      {{ type.label }}
                    </option>
                  </select>
                  <button class="mini danger" :disabled="columns.length <= 1" @click="removeColumn(colIndex)">x</button>
                </div>
              </th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="topSpacer > 0" class="spacer-row">
              <td :colspan="columns.length + 1" :style="{ height: `${topSpacer}px` }"></td>
            </tr>

            <tr v-for="(row, visibleIndex) in visibleRows" :key="startIndex + visibleIndex">
              <td class="row-number">
                <div class="row-controls">
                  <span>{{ startIndex + visibleIndex + 1 }}</span>
                  <button class="mini danger" @click="removeRow(startIndex + visibleIndex)">x</button>
                </div>
              </td>

              <td v-for="(column, colIndex) in columns" :key="column.id + '-' + (startIndex + visibleIndex)">
                <input
                  :data-cell="`${startIndex + visibleIndex}-${colIndex}`"
                  class="cell-input"
                  :class="{ 'is-invalid': isInvalidCell(startIndex + visibleIndex, colIndex) }"
                  :value="row[colIndex] ?? ''"
                  @input="updateCell(startIndex + visibleIndex, colIndex, ($event.target as HTMLInputElement).value)"
                  @keydown="handleCellKeydown($event, startIndex + visibleIndex, colIndex)"
                  @paste="handlePaste($event, startIndex + visibleIndex, colIndex)"
                />
              </td>
            </tr>

            <tr v-if="bottomSpacer > 0" class="spacer-row">
              <td :colspan="columns.length + 1" :style="{ height: `${bottomSpacer}px` }"></td>
            </tr>
          </tbody>
        </table>
      </div>

      <p v-if="validationMessage" class="error">{{ validationMessage }}</p>

      <footer class="manual-editor__footer">
        <button class="ghost" @click="closeEditor">Cancel</button>
        <button :disabled="!canSave" @click="saveDataset(false)">
          {{ saveBusy ? 'Saving...' : isEditing ? 'Save Changes' : 'Save Dataset' }}
        </button>
        <button :disabled="!canSave" class="primary" @click="saveDataset(true)">
          {{ saveBusy ? 'Saving...' : 'Create Chart from Data' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<style scoped>
.manual-editor-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 1300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
}

.manual-editor {
  width: min(1280px, 100%);
  max-height: calc(100vh - 32px);
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #dbe4f2;
  background: #ffffff;
  display: grid;
  grid-template-rows: auto auto auto 1fr auto auto;
  gap: 10px;
  padding: 14px;
}

.manual-editor__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.manual-editor__header h2 {
  margin: 0;
  font-size: 18px;
}

.hint {
  margin: 4px 0 0;
  color: #64748b;
  font-size: 12px;
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}

.meta-grid label {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  color: #475569;
}

.meta-grid input {
  height: 34px;
  border: 1px solid #cfd9ea;
  border-radius: 8px;
  padding: 0 10px;
}

.sheet-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.left-actions {
  display: flex;
  gap: 8px;
}

.sheet-stats {
  color: #64748b;
  font-size: 12px;
}

.sheet-wrap {
  border: 1px solid #dbe4f2;
  border-radius: 10px;
  overflow: auto;
  min-height: 320px;
  max-height: 52vh;
  background: #ffffff;
}

.paste-box-wrap {
  display: grid;
  gap: 6px;
}

.paste-box-wrap label {
  font-size: 12px;
  color: #475569;
}

.paste-box {
  min-height: 62px;
  max-height: 110px;
  resize: vertical;
  border: 1px solid #cfd9ea;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 12px;
}

.sheet-table {
  width: 100%;
  border-collapse: collapse;
}

.sheet-table thead th {
  position: sticky;
  top: 0;
  background: #f8fbff;
  border-bottom: 1px solid #dbe4f2;
  z-index: 2;
  padding: 6px;
  vertical-align: top;
}

.row-number {
  width: 64px;
  min-width: 64px;
  text-align: center;
  background: #f8fbff;
}

.column-head {
  display: grid;
  grid-template-columns: minmax(120px, 1fr) minmax(84px, 116px) auto;
  gap: 6px;
  align-items: center;
}

.column-name {
  height: 30px;
  border: 1px solid #cfd9ea;
  border-radius: 6px;
  padding: 0 8px;
}

.column-head select {
  height: 30px;
  border: 1px solid #cfd9ea;
  border-radius: 6px;
  padding: 0 6px;
  font-size: 12px;
}

.sheet-table td {
  border-bottom: 1px solid #edf2fa;
  border-right: 1px solid #edf2fa;
  padding: 0;
}

.cell-input {
  width: 100%;
  height: 34px;
  border: none;
  padding: 0 8px;
  font-size: 13px;
  outline: none;
  background: #ffffff;
}

.cell-input:focus {
  box-shadow: inset 0 0 0 2px rgba(37, 99, 235, 0.2);
}

.cell-input.is-invalid {
  background: #fff1f2;
  box-shadow: inset 0 0 0 1px #ef4444;
}

.row-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 34px;
  font-size: 12px;
}

.spacer-row td {
  border: none;
  padding: 0;
}

.manual-editor__footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

button {
  height: 36px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #ffffff;
  padding: 0 12px;
  cursor: pointer;
}

button.primary {
  background: #0f766e;
  border-color: #0f766e;
}

button.ghost {
  background: #ffffff;
  border-color: #cfd9ea;
  color: #334155;
}

button.small {
  height: 30px;
}

button.mini {
  height: 24px;
  width: 24px;
  border-radius: 5px;
  padding: 0;
  font-size: 12px;
}

button.danger {
  background: #ffffff;
  border-color: #fecaca;
  color: #b91c1c;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.error {
  color: #b91c1c;
  margin: 0;
  font-size: 13px;
}

@media (max-width: 980px) {
  .manual-editor {
    grid-template-rows: auto auto auto 1fr auto auto;
    padding: 10px;
  }

  .meta-grid {
    grid-template-columns: 1fr;
  }

  .column-head {
    grid-template-columns: 1fr;
  }
}
</style>
