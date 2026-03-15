<script setup lang="ts">
import * as d3 from 'd3'
import { onMounted, onUnmounted, ref, watch } from 'vue'
import type { ChartConfig, DataPoint } from './types'

// Ensure d3 is available globally for the external renderer
if (typeof window !== 'undefined' && !(window as any).d3) {
  (window as any).d3 = d3;
}

const props = defineProps<{
  chartConfig: ChartConfig
  dataset: DataPoint[]
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const sectionRef = ref<HTMLElement | null>(null)
let resizeObserver: ResizeObserver | null = null

const currentWidth = ref(860)
const currentHeight = ref(420)
let animationFrameId: number | null = null

function updateDimensions() {
  if (!sectionRef.value) return
  const rect = sectionRef.value.getBoundingClientRect()
  
  if (rect.width > 0 && rect.height > 0) {
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
    }
    
    currentWidth.value = rect.width
    currentHeight.value = rect.height
    
    animationFrameId = requestAnimationFrame(() => {
      renderChart()
    })
  }
}

function renderChart(): void {
  if (!svgRef.value) {
    return
  }

  const width = currentWidth.value
  const height = currentHeight.value

  const renderer = (window as any).ChartRenderer;
  if (renderer) {
    renderer.render(svgRef.value, props.dataset, props.chartConfig, { width, height });
  } else {
    console.warn("ChartRenderer is not loaded yet.");
  }
}

onMounted(() => {
  renderChart()
  
  if (sectionRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateDimensions()
    })
    resizeObserver.observe(sectionRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})

watch(
  () => props.chartConfig,
  () => {
    renderChart()
  },
  { deep: true },
)

watch(
  () => props.dataset,
  () => {
    renderChart()
  },
  { deep: true },
)
</script>

<template>
  <section ref="sectionRef" class="chart-canvas">
    <svg ref="svgRef" class="chart-svg" role="img" aria-label="Chart preview" />
  </section>
</template>

<style scoped>
.chart-canvas {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.chart-svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
