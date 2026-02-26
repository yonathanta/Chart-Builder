<script setup lang="ts">
import type { ChartConfig, ChartType, DataPoint } from './types'

const props = defineProps<{
  chartConfig: ChartConfig
  dataset: DataPoint[]
}>()

const emit = defineEmits<{
  (event: 'updateChart', config: Partial<ChartConfig>): void
  (event: 'loadDataset'): void
}>()

function updateTitle(value: string): void {
  emit('updateChart', { title: value })
}

function updateChartType(value: string): void {
  emit('updateChart', { chartType: value as ChartType })
}

function updatePrimaryColor(value: string): void {
  emit('updateChart', { colors: [value, props.chartConfig.colors[1]] })
}

function updateSecondaryColor(value: string): void {
  emit('updateChart', { colors: [props.chartConfig.colors[0], value] })
}

function loadSampleDataset(): void {
  emit('loadDataset')
}
</script>

<template>
  <aside class="chart-controls">
    <h2>Chart Controls</h2>

    <label class="control-field">
      <span>Title</span>
      <input :value="chartConfig.title" type="text" @input="updateTitle(($event.target as HTMLInputElement).value)" />
    </label>

    <label class="control-field">
      <span>Chart Type</span>
      <select :value="chartConfig.chartType" @change="updateChartType(($event.target as HTMLSelectElement).value)">
        <option value="bar">Bar</option>
        <option value="line">Line</option>
      </select>
    </label>

    <div class="color-row">
      <label class="control-field">
        <span>Primary Color</span>
        <input
          :value="chartConfig.colors[0]"
          type="color"
          @input="updatePrimaryColor(($event.target as HTMLInputElement).value)"
        />
      </label>

      <label class="control-field">
        <span>Secondary Color</span>
        <input
          :value="chartConfig.colors[1]"
          type="color"
          @input="updateSecondaryColor(($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>

    <p class="dataset-meta">Data points: {{ dataset.length }}</p>
    <button type="button" class="sample-btn" @click="loadSampleDataset">Load Existing Sample Data</button>
  </aside>
</template>

<style scoped>
.chart-controls {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-controls h2 {
  margin: 0;
  font-size: 1rem;
}

.control-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.control-field input[type='text'],
.control-field select {
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0 10px;
  background: #ffffff;
}

.control-field input[type='color'] {
  width: 52px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  padding: 0;
}

.color-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.dataset-meta {
  margin: 0;
  color: #6b7280;
  font-size: 0.9rem;
}

.sample-btn {
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #ffffff;
  cursor: pointer;
}

@media (max-width: 900px) {
  .color-row {
    grid-template-columns: 1fr;
  }
}
</style>
