<script setup lang="ts">
import { computed } from 'vue'
import { useProjectStore } from '../../stores/projectStore'
import ChartRenderer from '../ChartRenderer.vue'

const props = defineProps<{
  chartId: string
}>()

const projectStore = useProjectStore()
const chart = computed(() => projectStore.charts.find(c => c.id === props.chartId))
</script>

<template>
  <div class="chart-block">
    <div v-if="chart" class="chart-container">
      <div class="chart-header">
        <span class="chart-title">{{ chart.name }}</span>
      </div>
      <div class="chart-content">
        <ChartRenderer :chart="chart" />
      </div>
    </div>
    <div v-else class="chart-missing">
      Chart not found or removed.
    </div>
  </div>
</template>

<style scoped>
.chart-container {
  width: 100%;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.chart-header {
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.chart-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #64748b;
}

.chart-content {
  height: 400px;
  padding: 16px;
}

.chart-missing {
  padding: 40px;
  text-align: center;
  background: #fef2f2;
  color: #dc2626;
  border: 1px dashed #fecaca;
  border-radius: 8px;
}
</style>
