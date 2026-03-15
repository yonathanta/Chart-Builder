<script setup lang="ts">
import ChartRenderer from '../ChartRenderer.vue'

export type ReportLayoutItem = {
  id: string
  chartId: string
  chartName: string
  orderIndex: number
  chart: {
    id: string
    type: string
    config: unknown
    dataset: unknown
  } | null
}

defineProps<{
  items: ReportLayoutItem[]
  loading: boolean
}>()

const emit = defineEmits<{
  (event: 'moveUp', id: string): void
  (event: 'moveDown', id: string): void
  (event: 'remove', id: string): void
}>()
</script>

<template>
  <section class="report-layout">
    <header class="layout-head">
      <h2>Report Layout</h2>
      <span class="hint">Vertical sequence for PDF-friendly output</span>
    </header>

    <div v-if="loading" class="hint">Loading report charts...</div>
    <p v-else-if="items.length === 0" class="hint">No charts in this report yet.</p>

    <article v-for="(item, index) in items" v-else :key="item.id" class="chart-block">
      <div class="block-header">
        <div>
          <h3>{{ index + 1 }}. {{ item.chartName }}</h3>
          <p class="hint">Chart ID: {{ item.chartId }}</p>
        </div>

        <div class="actions">
          <button class="action-btn" :disabled="index === 0" @click="emit('moveUp', item.id)">Up</button>
          <button class="action-btn" :disabled="index === items.length - 1" @click="emit('moveDown', item.id)">Down</button>
          <button class="action-btn action-btn--danger" @click="emit('remove', item.id)">Remove</button>
        </div>
      </div>

      <div class="chart-surface">
        <ChartRenderer v-if="item.chart" :chart="item.chart" />
        <p v-else class="hint">Chart preview unavailable.</p>
      </div>
    </article>
  </section>
</template>

<style scoped>
.report-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.layout-head h2 {
  margin: 0;
  font-size: 18px;
}

.layout-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.chart-block {
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #fff;
  padding: 12px;
}

.block-header {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}

.block-header h3 {
  margin: 0;
  font-size: 15px;
}

.actions {
  display: flex;
  gap: 8px;
  align-items: start;
}

.action-btn {
  height: 32px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: #fff;
  padding: 0 10px;
  cursor: pointer;
}

.action-btn--danger {
  border-color: #dc2626;
  color: #dc2626;
}

.action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.chart-surface {
  height: 360px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.hint {
  color: #64748b;
  font-size: 12px;
  margin: 0;
}
</style>
