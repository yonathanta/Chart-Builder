<script setup lang="ts">
import { ref } from 'vue'
import ChartRenderer from '../ChartRenderer.vue'

export type GridChartItem = {
  layoutId: string
  chartId: string
  chartName: string
  x: number
  y: number
  w: number
  h: number
  chart: {
    id: string
    type: string
    config: unknown
    dataset: unknown
  } | null
}

const props = defineProps<{
  items: GridChartItem[]
  columns?: number
}>()

const emit = defineEmits<{
  (event: 'move', payload: { id: string; x: number; y: number }): void
  (event: 'resize', payload: { id: string; w: number; h: number }): void
  (event: 'add-chart', payload: { chartId: string; x: number; y: number }): void
}>()

const draggingId = ref<string | null>(null)

const rowHeightPx = 120
const gutterPx = 12

function startDrag(itemId: string, event: DragEvent): void {
  draggingId.value = itemId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', itemId)
  }
}

function onDrop(event: DragEvent): void {
  event.preventDefault()

  const target = event.currentTarget as HTMLElement | null
  if (!target) {
    return
  }

  const cols = props.columns ?? 12
  const rect = target.getBoundingClientRect()
  const colWidth = (rect.width - (cols - 1) * gutterPx) / cols

  const dropX = Math.floor((event.clientX - rect.left) / (colWidth + gutterPx))
  const dropY = Math.floor((event.clientY - rect.top) / (rowHeightPx + gutterPx))

  const droppedChartId = event.dataTransfer?.getData('application/x-chart-id')
  if (droppedChartId) {
    const x = Math.max(0, Math.min(cols - 4, dropX))
    const y = Math.max(0, dropY)
    emit('add-chart', { chartId: droppedChartId, x, y })
    draggingId.value = null
    return
  }

  const id = draggingId.value
  if (!id) {
    return
  }

  const item = props.items.find((candidate) => candidate.layoutId === id)
  if (!item) {
    draggingId.value = null
    return
  }

  const x = Math.max(0, Math.min(cols - item.w, dropX))
  const y = Math.max(0, dropY)

  emit('move', { id, x, y })
  draggingId.value = null
}

function resize(item: GridChartItem, dw: number, dh: number): void {
  const cols = props.columns ?? 12
  const w = Math.max(1, Math.min(cols - item.x, item.w + dw))
  const h = Math.max(1, item.h + dh)
  emit('resize', { id: item.layoutId, w, h })
}
</script>

<template>
  <section class="grid" @dragover.prevent @drop="onDrop">
    <div
      v-for="item in items"
      :key="item.layoutId"
      class="tile"
      :style="{ gridColumn: `${item.x + 1} / span ${item.w}`, gridRow: `${item.y + 1} / span ${item.h}` }"
      draggable="true"
      @dragstart="startDrag(item.layoutId, $event)"
    >
      <header class="tile-head">
        <span class="title">{{ item.chartName }}</span>
        <div class="actions">
          <button @click.stop="resize(item, -1, 0)">W-</button>
          <button @click.stop="resize(item, 1, 0)">W+</button>
          <button @click.stop="resize(item, 0, -1)">H-</button>
          <button @click.stop="resize(item, 0, 1)">H+</button>
        </div>
      </header>

      <div class="tile-body">
        <ChartRenderer v-if="item.chart" :chart="item.chart" />
        <div v-else class="placeholder">Chart data unavailable</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  grid-auto-rows: 120px;
  gap: 12px;
  min-height: 720px;
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 12px;
}

.tile {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.tile-head {
  height: 34px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  gap: 8px;
}

.title {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}

.actions {
  display: flex;
  gap: 4px;
}

.actions button {
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: #fff;
  height: 22px;
  min-width: 28px;
  font-size: 11px;
  cursor: pointer;
}

.tile-body {
  flex: 1;
  min-height: 0;
  padding: 8px;
}

.placeholder {
  height: 100%;
  display: grid;
  place-items: center;
  color: #64748b;
  font-size: 12px;
}
</style>
