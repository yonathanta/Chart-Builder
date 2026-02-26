<script setup lang="ts">
import type { ChartConfig, DataPoint } from './types'

defineProps<{
  chartConfig: ChartConfig
  dataset: DataPoint[]
}>()

defineEmits<{
  (event: 'reset-config'): void
}>()
</script>

<template>
  <section class="chart-toolbar">
    <h2>Chart Toolbar</h2>
    <span class="toolbar-meta">{{ dataset.length }} points · {{ chartConfig.title }}</span>
    <div class="toolbar-actions">
      <button type="button" @click="$emit('reset-config')">Reset Config</button>
    </div>
  </section>
</template>

<style scoped>
.chart-toolbar {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.chart-toolbar h2 {
  margin: 0;
  font-size: 1rem;
}

.toolbar-meta {
  color: #6b7280;
  font-size: 0.875rem;
}

.toolbar-actions {
  display: flex;
  gap: 8px;
}

.toolbar-actions button {
  border: 1px solid #d1d5db;
  background: #ffffff;
  border-radius: 6px;
  padding: 6px 10px;
  cursor: pointer;
}
</style>
