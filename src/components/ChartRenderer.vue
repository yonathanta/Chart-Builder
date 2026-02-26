<script setup lang="ts">
import { ref, onMounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { renderBarChart } from '../charts/bar'
import { createLineChart, type LineChartInstance } from '../charts/line'
import { drawAreaChart, type AreaChartInstance } from '../charts/areaV7'
import { renderDotDonutChart } from '../charts/dotDonut'
import { renderPieDonutChart } from '../charts/pie'
import { renderScatterPlot } from '../charts/scatter'
import { renderAfricaMap } from '../charts/map'
import { renderBubbleChart } from '../charts/bubble'
import { renderStackedBarChart } from '../charts/stackedBar'
import { renderOrbitDonutChart } from '../charts/orbitDonut'

const props = defineProps<{
  chart: {
    id: string;
    type: string;
    config: any;
    dataset: any;
  }
}>()

const svgRef = ref<SVGSVGElement | null>(null)
const frameRef = ref<HTMLDivElement | null>(null)
let lineChart: LineChartInstance | null = null
let areaChart: AreaChartInstance | null = null

async function render() {
  const { type, config } = props.chart
  // We need to fetch data if dataset is a URL string
  let data = props.chart.dataset
  if (typeof data === 'string' && data.startsWith('http')) {
    try {
      const res = await fetch(data)
      data = await res.json()
      if (data.data) data = data.data // Handle {data: []} wrapper
    } catch (e) {
      console.error('Failed to fetch dashboard chart data', e)
      return
    }
  }

  if (!data) return

  await nextTick()
  const svg = svgRef.value
  const frame = frameRef.value
  if (!svg || !frame) return

  // Basic dimensions for dashboard items
  const width = frame.clientWidth || 400
  const height = frame.clientHeight || 300

  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  if (lineChart) { lineChart.destroy(); lineChart = null; }
  if (areaChart) { areaChart.destroy(); areaChart = null; }

  svg.style.display = 'block'

  if (type === 'bar') {
    renderBarChart(svg, config, data, config.barConfig)
  } else if (type === 'line') {
    svg.style.display = 'none'
    lineChart = createLineChart(frame, data, { ...config.lineConfig, width, height })
  } else if (type === 'area') {
    svg.style.display = 'none'
    areaChart = drawAreaChart(frame, data, { ...config.areaConfig, width, height })
  } else if (type === 'dotDonut') {
    renderDotDonutChart(svg, config, data, config.dotDonutConfig)
  } else if (type === 'pie') {
    renderPieDonutChart(svg, config, data, config.pieConfig)
  } else if (type === 'scatter') {
    renderScatterPlot(svg, config, data, config.scatterConfig)
  } else if (type === 'map') {
    renderAfricaMap(svg, config, data, config.mapConfig)
  } else if (type === 'bubble') {
    renderBubbleChart(svg, config, data, config.bubbleConfig)
  } else if (type === 'stackedBar') {
    renderStackedBarChart(svg, config, data, config.stackedBarConfig)
  } else if (type === 'orbitDonut') {
    renderOrbitDonutChart(svg, config, data, config.orbitDonutConfig)
  }
}

onMounted(() => {
  render()
})

watch(() => props.chart, () => {
  render()
}, { deep: true })

onBeforeUnmount(() => {
  if (lineChart) lineChart.destroy()
  if (areaChart) areaChart.destroy()
})
</script>

<template>
  <div class="chart-renderer" ref="frameRef">
    <svg ref="svgRef"></svg>
  </div>
</template>

<style scoped>
.chart-renderer {
  width: 100%;
  height: 100%;
  position: relative;
  overflow: hidden;
}

svg {
  display: block;
}
</style>
