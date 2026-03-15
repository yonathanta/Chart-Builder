<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import ChartContainer from '../layout/ChartContainer.vue'
import ChartCanvas from '../chart/ChartCanvas.vue'
import datasetService from '@legacy/services/datasetService'
import type { ReportChartRecord } from '@legacy/services/reportService'

const props = defineProps<{
  layout: ReportChartRecord
}>()

const emit = defineEmits<{
  (e: 'update-layout', payload: { id: string; width: number; height: number }): void
}>()

const dataset = ref<any[]>([])
const chartConfig = ref<any>(null)
const isLoading = ref(true)

async function loadData() {
  isLoading.value = true
  try {
    if (props.layout.configJson) {
      chartConfig.value = JSON.parse(props.layout.configJson)
    }
    
    if (props.layout.datasetId) {
      const data = await datasetService.getDataset(props.layout.datasetId)
      if (data && data.dataJson) {
        dataset.value = JSON.parse(data.dataJson)
      }
    }
  } catch (err) {
    console.error("Failed to load chart data:", err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadData()
})

watch(() => props.layout, () => {
  if (props.layout.configJson) {
    chartConfig.value = JSON.parse(props.layout.configJson)
  }
}, { deep: true })

function handleUpdateLayout(payload: { id: string; width: number; height: number }) {
  emit('update-layout', payload)
}
</script>

<template>
  <ChartContainer
    :id="layout.id"
    :width="layout.width"
    :height="layout.height"
    :isResizable="true"
    @update-layout="handleUpdateLayout"
  >
    <div v-if="isLoading" class="loader">Loading chart...</div>
    <div v-else-if="!chartConfig || !dataset.length" class="loader">No data available</div>
    <ChartCanvas
      v-else
      :chart-config="chartConfig"
      :dataset="dataset"
    />
  </ChartContainer>
</template>

<style scoped>
.loader {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #6b7280;
}
</style>
