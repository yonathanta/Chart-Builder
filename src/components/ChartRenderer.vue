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
let resizeObserver: ResizeObserver | null = null
let resizeRaf = 0
let resizeTimer: ReturnType<typeof setTimeout> | null = null
let lastWidth = 0
let lastHeight = 0

function applyAdaptiveSvgTextSizing(svg: SVGSVGElement, width: number, height: number): void {
  const shortest = Math.max(220, Math.min(width, height))
  const areaScale = Math.sqrt((width * height) / 128000)
  const narrowPenalty = width < 320 ? 0.92 : width < 420 ? 0.96 : 1
  const scale = Math.max(0.68, Math.min(1.35, (shortest / 360) * areaScale * narrowPenalty))
  const textNodes = svg.querySelectorAll<SVGTextElement>('text')

  for (const node of textNodes) {
    const storedBase = node.dataset.baseFontSize
    let baseSize = Number.parseFloat(storedBase ?? '')

    if (!Number.isFinite(baseSize)) {
      const explicit = node.getAttribute('font-size') ?? node.style.fontSize
      const parsed = Number.parseFloat(explicit || '')
      const fallback = Number.parseFloat(window.getComputedStyle(node).fontSize || '12')
      baseSize = Number.isFinite(parsed) ? parsed : (Number.isFinite(fallback) ? fallback : 12)
      node.dataset.baseFontSize = String(baseSize)
    }

    const nextSize = Math.max(8, Math.min(24, baseSize * scale))
    node.style.setProperty('font-size', `${nextSize.toFixed(1)}px`)
  }
}

function adjustConfigForViewport(type: string, config: Record<string, unknown>, width: number, height: number): Record<string, unknown> {
  const compact = width < 480 || height < 260
  const medium = width < 720 || height < 320
  const next = {
    ...config,
  }

  if (!compact && !medium) {
    return next
  }

  const commonAxisPatch = {
    xLabelRotation: compact ? -35 : -20,
    labelFontSize: compact ? 10 : 11,
  }

  if (type === 'bar') {
    return {
      ...next,
      barConfig: {
        ...((next.barConfig as Record<string, unknown> | undefined) ?? {}),
        ...commonAxisPatch,
        showValues: compact ? false : undefined,
        labelDistance: compact ? 3 : undefined,
      },
    }
  }

  if (type === 'scatter') {
    return {
      ...next,
      scatterConfig: {
        ...((next.scatterConfig as Record<string, unknown> | undefined) ?? {}),
        showLegend: !compact,
      },
    }
  }

  if (type === 'stackedBar') {
    return {
      ...next,
      stackedBarConfig: {
        ...((next.stackedBarConfig as Record<string, unknown> | undefined) ?? {}),
        showLegend: !compact,
        showValues: !compact,
      },
    }
  }

  if (type === 'pie' || type === 'dotDonut' || type === 'orbitDonut') {
    return {
      ...next,
      showLegend: !compact,
    }
  }

  return next
}

function scheduleRender(force = false): void {
  if (resizeTimer) {
    clearTimeout(resizeTimer)
  }

  resizeTimer = setTimeout(() => {
    if (resizeRaf) {
      cancelAnimationFrame(resizeRaf)
    }

    resizeRaf = requestAnimationFrame(() => {
      render(force)
    })
  }, 80)
}

async function render(force = false) {
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
  if (width <= 0 || height <= 0) {
    return
  }

  if (!force && width === lastWidth && height === lastHeight) {
    return
  }

  lastWidth = width
  lastHeight = height

  svg.setAttribute('width', String(width))
  svg.setAttribute('height', String(height))

  const responsiveConfig = adjustConfigForViewport(type, config ?? {}, width, height)

  if (lineChart) { lineChart.destroy(); lineChart = null; }
  if (areaChart) { areaChart.destroy(); areaChart = null; }

  svg.style.display = 'block'
  let renderedSvg: SVGSVGElement | null = svg

  if (type === 'bar') {
    renderBarChart(svg, responsiveConfig, data, (responsiveConfig as any).barConfig)
  } else if (type === 'line') {
    svg.style.display = 'none'
    lineChart = createLineChart(frame, data, { ...(responsiveConfig as any).lineConfig, width, height })
    renderedSvg = frame.querySelector('svg') as SVGSVGElement | null
  } else if (type === 'area') {
    svg.style.display = 'none'
    areaChart = drawAreaChart(frame, data, { ...(responsiveConfig as any).areaConfig, width, height })
    renderedSvg = frame.querySelector('svg') as SVGSVGElement | null
  } else if (type === 'dotDonut') {
    renderDotDonutChart(svg, responsiveConfig, data, (responsiveConfig as any).dotDonutConfig)
  } else if (type === 'pie') {
    renderPieDonutChart(svg, responsiveConfig, data, (responsiveConfig as any).pieConfig)
  } else if (type === 'scatter') {
    renderScatterPlot(svg, responsiveConfig, data, (responsiveConfig as any).scatterConfig)
  } else if (type === 'map') {
    renderAfricaMap(svg, responsiveConfig, data, (responsiveConfig as any).mapConfig)
  } else if (type === 'bubble') {
    renderBubbleChart(svg, responsiveConfig, data, (responsiveConfig as any).bubbleConfig)
  } else if (type === 'stackedBar') {
    renderStackedBarChart(svg, responsiveConfig, data, (responsiveConfig as any).stackedBarConfig)
  } else if (type === 'orbitDonut') {
    renderOrbitDonutChart(svg, responsiveConfig, data, (responsiveConfig as any).orbitDonutConfig)
  }

  if (renderedSvg) {
    applyAdaptiveSvgTextSizing(renderedSvg, width, height)
  }
}

onMounted(() => {
  render(true)

  if (frameRef.value && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) {
        return
      }

      const width = Math.round(entry.contentRect.width)
      const height = Math.round(entry.contentRect.height)
      if (width <= 0 || height <= 0) {
        return
      }

      if (Math.abs(width - lastWidth) < 2 && Math.abs(height - lastHeight) < 2) {
        return
      }

      scheduleRender()
    })

    resizeObserver.observe(frameRef.value)
  }
})

watch(() => props.chart, () => {
  scheduleRender(true)
}, { deep: true })

onBeforeUnmount(() => {
  if (lineChart) lineChart.destroy()
  if (areaChart) areaChart.destroy()
  if (resizeObserver) resizeObserver.disconnect()
  if (resizeTimer) clearTimeout(resizeTimer)
  if (resizeRaf) cancelAnimationFrame(resizeRaf)
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
  min-width: 0;
  min-height: 0;
  position: relative;
  overflow: visible;
}

svg {
  display: block;
  width: 100%;
  height: 100%;
  overflow: visible;
}
</style>
