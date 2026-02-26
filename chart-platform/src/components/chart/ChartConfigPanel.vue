<script setup lang="ts">
import type { ChartConfig, ChartType } from './types'

const props = defineProps<{
  chartConfig: ChartConfig
}>()

const emit = defineEmits<{
  (event: 'updateChart', value: ChartConfig): void
}>()

function emitConfig(next: Partial<ChartConfig>): void {
  emit('updateChart', { ...props.chartConfig, ...next })
}

function updateChartType(value: string): void {
  emitConfig({ chartType: value as ChartType })
}

function updatePrimaryColor(value: string): void {
  emitConfig({ colors: [value, props.chartConfig.colors[1]] })
}

function updateXAxisLabel(value: string): void {
  emitConfig({ xAxisLabel: value })
}

function updateYAxisLabel(value: string): void {
  emitConfig({ yAxisLabel: value })
}

function updateAnimation(value: boolean): void {
  emitConfig({ animationEnabled: value })
}
</script>

<template>
  <aside class="chart-config-panel">
    <h2>Chart Config</h2>
    <label class="config-field">
      <span>Chart Type</span>
      <select
        :value="chartConfig.chartType"
        @change="updateChartType(($event.target as HTMLSelectElement).value)"
      >
        <option value="bar">Bar</option>
        <option value="line">Line</option>
      </select>
    </label>

    <label class="config-field">
      <span>Primary Color</span>
      <input
        :value="chartConfig.colors[0]"
        type="color"
        @input="updatePrimaryColor(($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="config-field">
      <span>X Axis Label</span>
      <input
        :value="chartConfig.xAxisLabel"
        type="text"
        @input="updateXAxisLabel(($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="config-field">
      <span>Y Axis Label</span>
      <input
        :value="chartConfig.yAxisLabel"
        type="text"
        @input="updateYAxisLabel(($event.target as HTMLInputElement).value)"
      />
    </label>

    <label class="checkbox-field">
      <input
        :checked="chartConfig.animationEnabled"
        type="checkbox"
        @change="updateAnimation(($event.target as HTMLInputElement).checked)"
      />
      <span>Enable Animation</span>
    </label>
  </aside>
</template>

<style scoped>
.chart-config-panel {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  min-height: 320px;
}

.chart-config-panel h2 {
  margin: 0 0 8px;
  font-size: 1rem;
}

.chart-config-panel p {
  margin: 0;
  color: #6b7280;
}

.config-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.config-field input[type='text'],
.config-field select {
  border: 1px solid #d1d5db;
  border-radius: 6px;
  height: 34px;
  padding: 0 10px;
  background: #ffffff;
}

.config-field input[type='color'] {
  width: 48px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  padding: 0;
  background: transparent;
}

.checkbox-field {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
