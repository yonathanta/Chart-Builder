<script setup lang="ts">
import { computed, ref } from 'vue'
import ChartRenderer from '../ChartRenderer.vue'

export type DashboardWidgetKind = 'chart' | 'title' | 'subtitle' | 'paragraph' | 'kpi' | 'table' | 'image' | 'icon'

export type DashboardCanvasItem = {
  id: string
  layoutId?: string
  kind: DashboardWidgetKind
  title: string
  x: number
  y: number
  w: number
  h: number
  chartId?: string
  chart?: {
    id: string
    type: string
    config: unknown
    dataset: unknown
  } | null
  text?: string
  imageUrl?: string
  icon?: string
  style?: {
    fontSize?: number
    fontWeight?: 'normal' | 'bold'
    textAlign?: 'left' | 'center' | 'right'
  }
  metadata?: {
    source?: string
    note?: string
  }
  binding?: {
    field?: string
  }
}

const props = defineProps<{
  items: DashboardCanvasItem[]
  pageId?: string
  selectedId?: string | null
  columns?: number
  rowHeightPx?: number
  deviceType?: 'mobile' | 'tablet' | 'desktop'
  canvasMode?: 'responsive' | 'a4'
  showGrid?: boolean
  snapToGrid?: boolean
  zoomPercent?: number
  datasetRows?: Array<Record<string, unknown>>
}>()

const emit = defineEmits<{
  (event: 'update-item', payload: { id: string; patch: Partial<DashboardCanvasItem> }): void
  (event: 'add-widget', payload: { pageId: string; kind: DashboardWidgetKind; chartId?: string; x: number; y: number }): void
  (event: 'select', payload: { id: string | null }): void
  (event: 'remove', payload: { id: string }): void
}>()

const canvasRef = ref<HTMLElement | null>(null)

const isMobile = computed(() => props.deviceType === 'mobile')
const isTablet = computed(() => props.deviceType === 'tablet')
const isDesktop = computed(() => !isMobile.value && !isTablet.value)

const cols = computed(() => {
  if (isMobile.value) return 1
  if (isTablet.value) return 6
  return props.columns ?? 12
})

const rowHeightPx = computed(() => props.rowHeightPx ?? 44)
const gutterPx = 10

const zoomScale = computed(() => {
  const zoom = props.zoomPercent ?? 100
  return Math.min(Math.max(zoom, 50), 200) / 100
})

const canvasShellStyle = computed(() => {
  if ((props.canvasMode ?? 'responsive') === 'a4') {
    return {
      width: '794px',
      minHeight: '1123px',
    }
  }

  return {
    width: '100%',
    minHeight: '760px',
  }
})

const canvasStyle = computed(() => {
  const showGrid = props.showGrid ?? true
  const rh = rowHeightPx.value
  const background = showGrid
    ? `
      linear-gradient(to right, rgba(148, 163, 184, 0.2) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(148, 163, 184, 0.2) 1px, transparent 1px)
    `
    : 'none'

  return {
    gridTemplateColumns: `repeat(${cols.value}, minmax(0, 1fr))`,
    gridAutoRows: `${rh}px`,
    backgroundImage: background,
    backgroundSize: `calc((100% - ${(cols.value - 1) * gutterPx}px) / ${cols.value} + ${gutterPx}px) ${rh + gutterPx}px`,
    transform: `scale(${zoomScale.value})`,
    transformOrigin: 'top left',
  }
})

const guideCol = ref<number | null>(null)
const guideRow = ref<number | null>(null)
const dropPreview = ref<{ x: number; y: number; w: number; h: number; kind: DashboardWidgetKind } | null>(null)

let dragState:
  | {
      id: string
      mode: 'move' | 'resize'
      startX: number
      startY: number
      originX: number
      originY: number
      originW: number
      originH: number
    }
  | null = null

function computeGridFromPointer(clientX: number, clientY: number): { col: number; row: number } | null {
  const canvas = canvasRef.value
  if (!canvas) {
    return null
  }

  const rect = canvas.getBoundingClientRect()
  const colWidth = (rect.width - (cols.value - 1) * gutterPx) / cols.value
  const rawCol = (clientX - rect.left) / (colWidth + gutterPx)
  const rawRow = (clientY - rect.top) / (rowHeightPx.value + gutterPx)

  const col = Math.floor(rawCol)
  const row = Math.floor(rawRow)
  return { col, row }
}

function findNearestGuides(targetId: string, x: number, y: number): void {
  const peers = props.items.filter((item) => item.id !== targetId)

  const nearX = peers.find((item) => Math.abs(item.x - x) <= 1)
  const nearY = peers.find((item) => Math.abs(item.y - y) <= 1)

  guideCol.value = nearX ? nearX.x : null
  guideRow.value = nearY ? nearY.y : null
}

function clearGuides(): void {
  guideCol.value = null
  guideRow.value = null
}

function startMove(item: DashboardCanvasItem, event: MouseEvent): void {
  if (!isDesktop.value) return

  dragState = {
    id: item.id,
    mode: 'move',
    startX: event.clientX,
    startY: event.clientY,
    originX: item.x,
    originY: item.y,
    originW: item.w,
    originH: item.h,
  }

  emit('select', { id: item.id })
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
}

function startResize(item: DashboardCanvasItem, event: MouseEvent): void {
  if (!isDesktop.value) return

  dragState = {
    id: item.id,
    mode: 'resize',
    startX: event.clientX,
    startY: event.clientY,
    originX: item.x,
    originY: item.y,
    originW: item.w,
    originH: item.h,
  }

  emit('select', { id: item.id })
  window.addEventListener('mousemove', onPointerMove)
  window.addEventListener('mouseup', onPointerUp)
}

function onPointerMove(event: MouseEvent): void {
  if (!dragState) return

  const canvas = canvasRef.value
  if (!canvas) return

  const rect = canvas.getBoundingClientRect()
  const colWidth = (rect.width - (cols.value - 1) * gutterPx) / cols.value
  const dx = event.clientX - dragState.startX
  const dy = event.clientY - dragState.startY

  const deltaCols = dx / (colWidth + gutterPx)
  const deltaRows = dy / (rowHeightPx.value + gutterPx)
  const snap = props.snapToGrid ?? true

  if (dragState.mode === 'move') {
    let nextX = dragState.originX + (snap ? Math.round(deltaCols) : Math.trunc(deltaCols))
    let nextY = dragState.originY + (snap ? Math.round(deltaRows) : Math.trunc(deltaRows))

    const item = props.items.find((candidate) => candidate.id === dragState?.id)
    if (!item) return

    nextX = Math.max(0, Math.min(cols.value - item.w, nextX))
    nextY = Math.max(0, nextY)

    findNearestGuides(item.id, nextX, nextY)
    emit('update-item', { id: item.id, patch: { x: nextX, y: nextY } })
    return
  }

  let nextW = dragState.originW + (snap ? Math.round(deltaCols) : Math.trunc(deltaCols))
  let nextH = dragState.originH + (snap ? Math.round(deltaRows) : Math.trunc(deltaRows))

  const item = props.items.find((candidate) => candidate.id === dragState?.id)
  if (!item) return

  nextW = Math.max(1, Math.min(cols.value - item.x, nextW))
  nextH = Math.max(1, nextH)
  emit('update-item', { id: item.id, patch: { w: nextW, h: nextH } })
}

function onPointerUp(): void {
  dragState = null
  clearGuides()
  window.removeEventListener('mousemove', onPointerMove)
  window.removeEventListener('mouseup', onPointerUp)
}

function clearDropPreview(): void {
  dropPreview.value = null
}

function defaultSizeByKind(kind: DashboardWidgetKind): { w: number; h: number } {
  if (kind === 'title') return { w: 8, h: 3 }
  if (kind === 'subtitle') return { w: 7, h: 3 }
  if (kind === 'paragraph') return { w: 6, h: 6 }
  if (kind === 'kpi') return { w: 3, h: 4 }
  if (kind === 'table') return { w: 6, h: 6 }
  if (kind === 'image') return { w: 5, h: 6 }
  if (kind === 'icon') return { w: 2, h: 3 }
  return { w: 4, h: 4 }
}

function parseDropKind(event: DragEvent): DashboardWidgetKind | null {
  const chartId = event.dataTransfer?.getData('application/x-chart-id')
  if (chartId) return 'chart'

  const kind = event.dataTransfer?.getData('application/x-widget-kind') as DashboardWidgetKind | ''
  if (kind) return kind

  const textFallback = event.dataTransfer?.getData('text/plain') ?? ''
  if (textFallback.startsWith('chart:')) return 'chart'
  if (textFallback.startsWith('widget:')) {
    const parsed = textFallback.slice('widget:'.length).trim()
    if (parsed === 'title' || parsed === 'subtitle' || parsed === 'paragraph' || parsed === 'kpi' || parsed === 'table' || parsed === 'image' || parsed === 'icon' || parsed === 'chart') {
      return parsed
    }
  }

  return null
}

function onDragOver(event: DragEvent): void {
  event.preventDefault()
  if (event.dataTransfer) {
    event.dataTransfer.dropEffect = 'copy'
  }

  const gridPos = computeGridFromPointer(event.clientX, event.clientY)
  const kind = parseDropKind(event)
  if (!gridPos || !kind) {
    clearDropPreview()
    return
  }

  const size = defaultSizeByKind(kind)
  dropPreview.value = {
    kind,
    x: Math.max(0, Math.min(cols.value - size.w, gridPos.col)),
    y: Math.max(0, gridPos.row),
    w: size.w,
    h: size.h,
  }
}

function onDragLeave(event: DragEvent): void {
  const related = event.relatedTarget as Node | null
  if (related && canvasRef.value?.contains(related)) {
    return
  }
  clearDropPreview()
}

function onDrop(event: DragEvent): void {
  event.preventDefault()
  clearDropPreview()

  const pageId = props.pageId ?? ''
  if (!pageId) {
    return
  }

  const gridPos = computeGridFromPointer(event.clientX, event.clientY)
  if (!gridPos) {
    return
  }

  const chartId = event.dataTransfer?.getData('application/x-chart-id')
  if (chartId) {
    const size = defaultSizeByKind('chart')
    emit('add-widget', {
      pageId,
      kind: 'chart',
      chartId,
      x: Math.max(0, Math.min(cols.value - size.w, gridPos.col)),
      y: Math.max(0, gridPos.row),
    })
    return
  }

  const textFallback = event.dataTransfer?.getData('text/plain') ?? ''
  if (textFallback.startsWith('chart:')) {
    const parsedChartId = textFallback.slice('chart:'.length).trim()
    if (parsedChartId) {
      const size = defaultSizeByKind('chart')
      emit('add-widget', {
        pageId,
        kind: 'chart',
        chartId: parsedChartId,
        x: Math.max(0, Math.min(cols.value - size.w, gridPos.col)),
        y: Math.max(0, gridPos.row),
      })
      return
    }
  }

  const kind = event.dataTransfer?.getData('application/x-widget-kind') as DashboardWidgetKind | ''
  if (kind) {
    const size = defaultSizeByKind(kind)
    emit('add-widget', {
      pageId,
      kind,
      x: Math.max(0, Math.min(cols.value - size.w, gridPos.col)),
      y: Math.max(0, gridPos.row),
    })
    return
  }

  if (textFallback.startsWith('widget:')) {
    const parsedKind = textFallback.slice('widget:'.length).trim()
    if (parsedKind === 'title' || parsedKind === 'subtitle' || parsedKind === 'paragraph' || parsedKind === 'kpi' || parsedKind === 'table' || parsedKind === 'image' || parsedKind === 'icon' || parsedKind === 'chart') {
      const size = defaultSizeByKind(parsedKind)
      emit('add-widget', {
        pageId,
        kind: parsedKind,
        x: Math.max(0, Math.min(cols.value - size.w, gridPos.col)),
        y: Math.max(0, gridPos.row),
      })
    }
  }
}

function tileStyle(item: DashboardCanvasItem): Record<string, string> {
  if (!isDesktop.value) {
    return {}
  }

  return {
    gridColumn: `${item.x + 1} / span ${item.w}`,
    gridRow: `${item.y + 1} / span ${item.h}`,
  }
}

function updateText(item: DashboardCanvasItem, text: string): void {
  emit('update-item', { id: item.id, patch: { text } })
}

function updateImage(item: DashboardCanvasItem, imageUrl: string): void {
  emit('update-item', { id: item.id, patch: { imageUrl } })
}

function textStyle(item: DashboardCanvasItem): Record<string, string> {
  const style = item.style ?? {}
  return {
    fontSize: style.fontSize ? `${style.fontSize}px` : '',
    fontWeight: style.fontWeight ?? '',
    textAlign: style.textAlign ?? '',
  }
}

function computedKpi(item: DashboardCanvasItem): string {
  const rows = props.datasetRows ?? []
  const field = item.binding?.field
  if (!field || rows.length === 0) {
    return 'N/A'
  }

  const values = rows
    .map((row) => Number(row[field]))
    .filter((value) => Number.isFinite(value))

  if (values.length === 0) {
    return 'N/A'
  }

  const total = values.reduce((acc, value) => acc + value, 0)
  return total.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function tableHeaders(rows: Array<Record<string, unknown>>): string[] {
  if (rows.length === 0) return []
  return Object.keys(rows[0] ?? {}).slice(0, 5)
}
</script>

<template>
  <section class="canvas-wrap" @dragover="onDragOver" @dragleave="onDragLeave" @dragenter.prevent @drop="onDrop">
    <div class="canvas-shell" :style="canvasShellStyle" @dragover="onDragOver" @dragleave="onDragLeave" @dragenter.prevent @drop="onDrop">
      <section
        ref="canvasRef"
        class="grid"
        :class="[`grid--${deviceType ?? 'desktop'}`, (canvasMode ?? 'responsive') === 'a4' ? 'grid--a4' : 'grid--responsive']"
        :style="canvasStyle"
        @dragover="onDragOver"
        @dragleave="onDragLeave"
        @dragenter.prevent
        @drop="onDrop"
        @click.self="emit('select', { id: null })"
      >
        <div
          v-if="dropPreview"
          class="drop-preview"
          :style="{ gridColumn: `${dropPreview.x + 1} / span ${dropPreview.w}`, gridRow: `${dropPreview.y + 1} / span ${dropPreview.h}` }"
        ></div>

        <div
          v-if="guideCol !== null"
          class="guide guide--vertical"
          :style="{ gridColumn: `${guideCol + 1}` }"
        ></div>
        <div
          v-if="guideRow !== null"
          class="guide guide--horizontal"
          :style="{ gridRow: `${guideRow + 1}` }"
        ></div>

        <article
          v-for="item in items"
          :key="item.id"
          class="tile"
          :class="{ 'tile--selected': selectedId === item.id }"
          :style="tileStyle(item)"
          @click.stop="emit('select', { id: item.id })"
        >
          <header class="tile-head" @mousedown.left.stop.prevent="startMove(item, $event)">
            <div class="tile-title-wrap">
              <span class="title">{{ item.title }}</span>
              <span v-if="item.metadata?.source || item.metadata?.note" class="meta-dot" :title="`Source: ${item.metadata?.source || 'N/A'}\nNote: ${item.metadata?.note || 'N/A'}`">i</span>
            </div>
            <button class="delete-btn" type="button" @click.stop="emit('remove', { id: item.id })">x</button>
          </header>

          <div class="tile-body">
            <ChartRenderer v-if="item.kind === 'chart' && item.chart" :chart="item.chart" />

            <input
              v-else-if="item.kind === 'title'"
              class="text-input text-input--title"
              :style="textStyle(item)"
              :value="item.text || ''"
              placeholder="Title"
              @input="updateText(item, ($event.target as HTMLInputElement).value)"
            />

            <input
              v-else-if="item.kind === 'subtitle'"
              class="text-input text-input--subtitle"
              :style="textStyle(item)"
              :value="item.text || ''"
              placeholder="Subtitle"
              @input="updateText(item, ($event.target as HTMLInputElement).value)"
            />

            <textarea
              v-else-if="item.kind === 'paragraph'"
              class="text-input text-input--paragraph"
              :style="textStyle(item)"
              :value="item.text || ''"
              rows="6"
              placeholder="Paragraph"
              @input="updateText(item, ($event.target as HTMLTextAreaElement).value)"
            ></textarea>

            <div v-else-if="item.kind === 'kpi'" class="kpi-card">
              <p class="kpi-label">{{ item.binding?.field || 'Select KPI field' }}</p>
              <p class="kpi-value">{{ computedKpi(item) }}</p>
            </div>

            <div v-else-if="item.kind === 'table'" class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th v-for="header in tableHeaders(datasetRows ?? [])" :key="`${item.id}-${header}`">{{ header }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in (datasetRows ?? []).slice(0, 5)" :key="`${item.id}-row-${rowIndex}`">
                    <td v-for="header in tableHeaders(datasetRows ?? [])" :key="`${item.id}-${rowIndex}-${header}`">
                      {{ row[header] }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else-if="item.kind === 'image'" class="image-wrap">
              <input
                class="text-input"
                :value="item.imageUrl || ''"
                placeholder="Image URL"
                @input="updateImage(item, ($event.target as HTMLInputElement).value)"
              />
              <img v-if="item.imageUrl" :src="item.imageUrl" alt="Widget image" />
            </div>

            <div v-else-if="item.kind === 'icon'" class="icon-wrap">{{ item.icon || '★' }}</div>

            <div v-else class="placeholder">Component unavailable</div>
          </div>

          <span
            v-if="isDesktop"
            class="resize-handle"
            @mousedown.left.stop.prevent="startResize(item, $event)"
          ></span>
        </article>
      </section>
    </div>
  </section>
</template>

<style scoped>
.canvas-wrap {
  overflow: auto;
  border: 1px solid #dbe4f0;
  border-radius: 12px;
  background: #f1f5f9;
  padding: 12px;
}

.canvas-shell {
  margin: 0 auto;
}

.grid {
  display: grid;
  gap: 10px;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  background-color: #ffffff;
  padding: 10px;
  min-height: 760px;
  position: relative;
}

.grid--a4 {
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
}

.tile {
  border: 1px solid #dbe4f0;
  border-radius: 10px;
  background: #ffffff;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
  position: relative;
}

.tile--selected {
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.35);
  border-color: #93c5fd;
}

.tile-head {
  min-height: 32px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  cursor: move;
}

.tile-title-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta-dot {
  width: 16px;
  height: 16px;
  border-radius: 999px;
  border: 1px solid #cbd5e1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #0f4fa8;
}

.delete-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  width: 20px;
  height: 20px;
  border-radius: 5px;
  font-size: 11px;
  cursor: pointer;
}

.tile-body {
  flex: 1;
  min-height: 0;
  padding: 8px;
  content-visibility: auto;
}

.text-input {
  width: 100%;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 10px;
}

.text-input--title {
  font-size: 32px;
  font-weight: 800;
  line-height: 1.2;
}

.text-input--subtitle {
  font-size: 22px;
  font-weight: 700;
  line-height: 1.3;
}

.text-input--paragraph {
  min-height: 140px;
  resize: vertical;
  font-size: 14px;
  line-height: 1.7;
}

.kpi-card {
  height: 100%;
  border: 1px solid #dbe4f0;
  border-radius: 8px;
  background: linear-gradient(180deg, #eff6ff 0%, #dbeafe 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.kpi-label {
  margin: 0;
  color: #475569;
  font-size: 12px;
}

.kpi-value {
  margin: 0;
  color: #0f172a;
  font-size: 28px;
  font-weight: 800;
}

.table-wrap {
  height: 100%;
  overflow: auto;
}

table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th,
td {
  border: 1px solid #e2e8f0;
  padding: 6px;
  text-align: left;
}

.image-wrap {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
}

.image-wrap img {
  width: 100%;
  height: calc(100% - 40px);
  object-fit: contain;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
}

.icon-wrap {
  height: 100%;
  display: grid;
  place-items: center;
  font-size: 56px;
  color: #1d4ed8;
}

.placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 12px;
}

.resize-handle {
  position: absolute;
  right: 6px;
  bottom: 6px;
  width: 12px;
  height: 12px;
  border-radius: 3px;
  background: rgba(37, 99, 235, 0.85);
  cursor: nwse-resize;
}

.guide {
  pointer-events: none;
  z-index: 20;
}

.drop-preview {
  pointer-events: none;
  z-index: 12;
  border: 2px dashed #2563eb;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.14);
}

.guide--vertical {
  grid-row: 1 / -1;
  border-left: 1px dashed #2563eb;
}

.guide--horizontal {
  grid-column: 1 / -1;
  border-top: 1px dashed #2563eb;
}

@media (max-width: 1024px) {
  .grid {
    transform: none !important;
  }
}
</style>
