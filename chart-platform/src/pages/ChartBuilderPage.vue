<script setup lang="ts">
import { reactive, ref } from 'vue'
import ChartCanvas from '../components/chart/ChartCanvas.vue'
import ChartToolbar from '../components/chart/ChartToolbar.vue'
import ChartConfigPanel from '../components/chart/ChartConfigPanel.vue'
import type { ChartConfig, DataPoint } from '../components/chart/types'

const dataset = ref<DataPoint[]>([
  { label: 'A', value: 32 },
  { label: 'B', value: 48 },
  { label: 'C', value: 21 },
  { label: 'D', value: 57 },
])

const chartConfig = reactive<ChartConfig>({
  title: 'Sample Bar Chart',
  color: '#2563eb',
  showLegend: true,
})

function updateChartConfig(nextConfig: ChartConfig): void {
  chartConfig.title = nextConfig.title
  chartConfig.color = nextConfig.color
  chartConfig.showLegend = nextConfig.showLegend
}

function resetChartConfig(): void {
  updateChartConfig({
    title: 'Sample Bar Chart',
    color: '#2563eb',
    showLegend: true,
  })
}
</script>

<template>
  <main class="chart-builder-page">
    <h1>Chart Builder</h1>
    <ChartToolbar :chart-config="chartConfig" :dataset="dataset" @reset-config="resetChartConfig" />

    <section class="builder-layout">
      <ChartCanvas :chart-config="chartConfig" :dataset="dataset" />
      <ChartConfigPanel
        :chart-config="chartConfig"
        :dataset="dataset"
        @update:chart-config="updateChartConfig"
      />
    </section>
  </main>
</template>

<style scoped>
.chart-builder-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.chart-builder-page h1 {
  margin: 0;
}

.builder-layout {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 12px;
}

@media (max-width: 900px) {
  .builder-layout {
    grid-template-columns: 1fr;
  }
}
</style>
