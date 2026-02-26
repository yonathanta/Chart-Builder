<script setup lang="ts">
import * as d3 from 'd3'
import { onMounted, ref, watch } from 'vue'
import type { ChartConfig, DataPoint } from './types'

const props = defineProps<{
  chartConfig: ChartConfig
  dataset: DataPoint[]
}>()

const svgRef = ref<SVGSVGElement | null>(null)

function renderChart(): void {
  if (!svgRef.value) {
    return
  }

  const width = 860
  const height = 420
  const margin = { top: 40, right: 24, bottom: 44, left: 56 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom

  const svg = d3
    .select(svgRef.value)
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('preserveAspectRatio', 'xMidYMid meet')

  svg.selectAll('*').remove()

  const data = props.dataset
  const safeMax = d3.max(data, (d) => d.value) ?? 1

  const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

  root
    .append('text')
    .attr('x', 0)
    .attr('y', -12)
    .attr('fill', '#111827')
    .style('font-size', '16px')
    .style('font-weight', '600')
    .text(props.chartConfig.title)

  const xScale = d3
    .scaleBand<string>()
    .domain(data.map((d) => d.label))
    .range([0, innerWidth])
    .padding(0.25)

  const yScale = d3.scaleLinear().domain([0, safeMax * 1.1]).nice().range([innerHeight, 0])

  root
    .append('g')
    .attr('transform', `translate(0,${innerHeight})`)
    .call(d3.axisBottom(xScale))

  root.append('g').call(d3.axisLeft(yScale).ticks(6))

  root
    .append('text')
    .attr('x', innerWidth / 2)
    .attr('y', innerHeight + 38)
    .attr('text-anchor', 'middle')
    .attr('fill', '#374151')
    .style('font-size', '12px')
    .text(props.chartConfig.xAxisLabel)

  root
    .append('text')
    .attr('transform', 'rotate(-90)')
    .attr('x', -innerHeight / 2)
    .attr('y', -40)
    .attr('text-anchor', 'middle')
    .attr('fill', '#374151')
    .style('font-size', '12px')
    .text(props.chartConfig.yAxisLabel)

  if (props.chartConfig.chartType === 'line') {
    const lineGenerator = d3
      .line<DataPoint>()
      .x((d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
      .y((d) => yScale(d.value))

    const linePath = root
      .append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', props.chartConfig.colors[0])
      .attr('stroke-width', 2.5)
      .attr('d', lineGenerator)

    if (props.chartConfig.animationEnabled) {
      const totalLength = linePath.node()?.getTotalLength() ?? 0
      linePath
        .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
        .attr('stroke-dashoffset', totalLength)
        .transition()
        .duration(600)
        .ease(d3.easeCubicOut)
        .attr('stroke-dashoffset', 0)
    }

    root
      .selectAll('circle.data-point')
      .data(data)
      .join('circle')
      .attr('class', 'data-point')
      .attr('cx', (d) => (xScale(d.label) ?? 0) + xScale.bandwidth() / 2)
      .attr('cy', (d) => yScale(d.value))
      .attr('r', 4)
      .attr('fill', props.chartConfig.colors[1])
  } else {
    const bars = root
      .selectAll('rect.bar')
      .data(data)
      .join('rect')
      .attr('class', 'bar')
      .attr('x', (d) => xScale(d.label) ?? 0)
      .attr('y', innerHeight)
      .attr('width', xScale.bandwidth())
      .attr('height', 0)
      .attr('rx', 4)
      .attr('fill', props.chartConfig.colors[0])

    const targetBars = bars
      .attr('y', (d) => yScale(d.value))
      .attr('height', (d) => innerHeight - yScale(d.value))

    if (props.chartConfig.animationEnabled) {
      targetBars.transition().duration(550).ease(d3.easeCubicOut)
    }
  }
}

onMounted(() => {
  renderChart()
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
  <section class="chart-canvas">
    <svg ref="svgRef" class="chart-svg" role="img" aria-label="Chart preview" />
  </section>
</template>

<style scoped>
.chart-canvas {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 12px;
  min-height: 360px;
  display: flex;
  align-items: stretch;
}

.chart-svg {
  width: 100%;
  min-height: 340px;
  display: block;
}
</style>
