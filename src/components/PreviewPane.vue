<script setup lang="ts">
import { onMounted, ref, watch, nextTick, onBeforeUnmount, computed, reactive } from "vue";
import type { ChartSpec } from "../specs/chartSpec";
import { renderBarChart, type BuilderBarConfig } from "../charts/bar";
import { createLineChart, type LineChartConfig, type LineChartInstance } from "../charts/line";
import { drawAreaChart, type AreaChartConfig, type AreaChartInstance } from "../charts/areaV7";
import { renderDotDonutChart, type DotDonutConfig } from "../charts/dotDonut";
import { renderPieDonutChart, type PieConfig } from "../charts/pie";
import { renderScatterPlot, type ScatterConfig } from "../charts/scatter";
import { renderAfricaMap, type MapConfig } from "../charts/map";
import { renderBubbleChart, type BubbleChartConfig } from "../charts/bubble";
import { renderStackedBarChart, type StackedBarConfig } from "../charts/stackedBar";
import { renderOrbitDonutChart, type OrbitDonutConfig } from "../charts/orbitDonut";

const props = defineProps<{
  spec: ChartSpec;
  lastValidated?: string;
  barConfig?: BuilderBarConfig;
  lineConfig?: any;
  areaConfig?: any;
  stackedAreaConfig?: any;
  dotDonutConfig?: DotDonutConfig;
  pieConfig?: PieConfig;
  scatterConfig?: ScatterConfig;
  mapConfig?: MapConfig;
  bubbleConfig?: BubbleChartConfig;
  stackedBarConfig?: StackedBarConfig;
  orbitDonutConfig?: OrbitDonutConfig;
  selectedYears?: string[];
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "update:fields", payload: string[]): void;
  (e: "update:encoding", payload: { category: string; value: string; series?: string }): void;
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const frameRef = ref<HTMLDivElement | null>(null);
const status = ref<string>("");
const error = ref<string | null>(null);
let lineChart: LineChartInstance | null = null;
let areaChart: AreaChartInstance | null = null;

const rows = ref<Record<string, unknown>[]>([]);
const selectedRow = ref<number | null>(null);
const selectedColumn = ref<string | null>(null);
const mapping = reactive<{ category?: string; value?: string; series?: string }>({});
const editValue = ref<string>("");
// Excel-like value filters per column
const valueFilterSelections = reactive({} as Record<string, Set<string> | null>);
const openFilterCol = ref<string | null>(null);
const filterPosition = ref<{ top: number; left: number }>({ top: 0, left: 0 });
const valueFilterSearch = ref<string>("");
const tempSelection = ref<Set<string>>(new Set());

const columns = computed(() => {
  const first = rows.value[0];
  return first ? Object.keys(first) : [];
});

watch(
  () => props.spec.encoding,
  (enc) => {
    mapping.category = enc.category?.field;
    mapping.value = enc.value?.field;
    mapping.series = enc.series?.field;
  },
  { deep: true, immediate: true }
);

watch(columns, (cols) => {
  // prune any value filters for columns that no longer exist
  Object.keys(valueFilterSelections).forEach(key => { if (!cols.includes(key)) delete valueFilterSelections[key]; });
  // keep mapping valid
  if (cols.length) {
    if (!mapping.category || !cols.includes(mapping.category)) mapping.category = cols[0];
    if (!mapping.value || !cols.includes(mapping.value)) mapping.value = cols[1] ?? cols[0];
    if (mapping.series && !cols.includes(mapping.series)) mapping.series = undefined;
  } else {
    mapping.category = undefined;
    mapping.value = undefined;
    mapping.series = undefined;
  }
}, { immediate: true });

watch(columns, (cols) => {
  // prune any value filters for columns that no longer exist
  Object.keys(valueFilterSelections).forEach(key => { if (!cols.includes(key)) delete valueFilterSelections[key]; });
}, { immediate: true });

function uniqueValuesFor(col: string): string[] {
  const set = new Set<string>();
  for (const r of rows.value) {
    const v = (r as any)[col];
    set.add(String(v))
  }
  return Array.from(set.values()).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
}

const visibleFilterValues = computed(() => {
  const col = openFilterCol.value;
  if (!col) return [] as string[];
  const term = valueFilterSearch.value.trim().toLowerCase();
  const all = uniqueValuesFor(col);
  return term ? all.filter(v => v.toLowerCase().includes(term)) : all;
});


function openValueFilter(col: string, event?: MouseEvent) {
  openFilterCol.value = openFilterCol.value === col ? null : col;
  valueFilterSearch.value = "";
  const current = valueFilterSelections[col];
  const all = uniqueValuesFor(col);
  tempSelection.value = new Set(current ? Array.from(current) : all);
  if (event?.currentTarget instanceof HTMLElement) {
    const rect = event.currentTarget.getBoundingClientRect();
    filterPosition.value = { top: rect.bottom, left: rect.left-120 };
  }

}

function toggleTempAll(checked: boolean) {
  const col = openFilterCol.value;
  if (!col) return;
  if (checked) tempSelection.value = new Set(uniqueValuesFor(col));
  else tempSelection.value = new Set();
}

function toggleTempValue(v: string, checked: boolean) {
  const next = new Set(tempSelection.value);
  if (checked) next.add(v); else next.delete(v);
  tempSelection.value = next;
}

function applyValueFilter() {
  const col = openFilterCol.value;
  if (!col) return;
  const all = uniqueValuesFor(col);
  const selected = Array.from(tempSelection.value);
  // If all selected, treat as no filter
  valueFilterSelections[col] = selected.length === all.length ? null : new Set(selected);
  openFilterCol.value = null;
}

function clearValueFilter(col?: string) {
  const key = col ?? openFilterCol.value ?? undefined;
  if (!key) return;
  valueFilterSelections[key] = null;
  if (!col) openFilterCol.value = null;
}

function isColFiltered(col: string) {
  return !!valueFilterSelections[col] && (valueFilterSelections[col] as Set<string>).size >= 0;
}

const filteredRowsWithIndex = computed(() => {
  const cols = columns.value;
  return rows.value.reduce<Array<{ row: Record<string, unknown>; index: number }>>((acc, row, index) => {
    const passesValueFilter = cols.every(c => {
      const set = valueFilterSelections[c];
      if (!set) return true; // no filter on this column
      const cell = (row as any)[c];
      return set.has(String(cell));
    });
    if (passesValueFilter) acc.push({ row, index });
    return acc;
  }, []);
});

const filteredRows = computed(() => filteredRowsWithIndex.value.map(r => r.row));

watch(
  () => ({ ...mapping }),
  (next) => {
    if (next.category && next.value) {
      emit("update:encoding", { category: next.category, value: next.value, series: next.series });
    }
  },
  { deep: true }
);

const totalFiltered = computed(() => filteredRowsWithIndex.value.length);

async function loadAndRender() {
  if (!svgRef.value) return;
  status.value = "Loading data…";
  error.value = null;

  try {
    const res = await fetch(props.spec.data.query.source);
    if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
    const raw = await res.json();
    let fetchedRows = Array.isArray(raw) ? raw : Array.isArray(raw.data) ? raw.data : [];

    rows.value = fetchedRows;
    emit("update:fields", columns.value);

    const width = props.spec.layout?.width ?? 720;
    const height = props.spec.layout?.height ?? 420;

    // Always size the built-in SVG; hidden for non-bar types
    const svg = svgRef.value;
    svg.setAttribute("width", String(width));
    svg.setAttribute("height", String(height));

    await nextTick();

    // Clean any prior chart instances when switching types
    if (lineChart) { lineChart.destroy(); lineChart = null; }
    if (areaChart) { areaChart.destroy(); areaChart = null; }

    if (props.spec.type === "bar") {
      // Ensure the SVG is visible for bar
      svg.style.display = "block";
      // Apply year filter if present and series field exists
      const seriesField = props.spec.encoding.series?.field;
      let renderRows = filteredRows.value;
      if (seriesField && props.selectedYears && props.selectedYears.length) {
        renderRows = renderRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
      }
      renderBarChart(svg, props.spec, renderRows, { ...props.barConfig, numberFormat: props.barConfig?.numberFormat ?? '~s' });
      status.value = "Rendered bar chart";
    } else if (props.spec.type === "line") {
      // Hide the bar SVG and render line into the frame container
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container for line chart");

      // Build a config mapping from spec when possible; allow overrides from lineConfig
      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const seriesField = props.spec.encoding.series?.field;
      const cfg: any = {
        xKey,
        yKey,
        xType: props.lineConfig?.axisConfig?.showXAxis ? (props.lineConfig?.dataConfig?.xType || 'time') : 'category',
        xFormat: props.lineConfig?.dataConfig?.xFormat || '%Y-%m-%d',
        yType: 'linear',
        width,
        height,
        margin: { top: 24, right: 24, bottom: 40, left: 52 },
        lineColor: props.lineConfig?.lineStyle?.color || '#2563eb',
        lineWidth: props.lineConfig?.lineStyle?.strokeWidth || 2,
        curveType: props.lineConfig?.lineStyle?.curveType || 'linear',
        showXAxis: props.lineConfig?.axisConfig?.showXAxis ?? true,
        showYAxis: props.lineConfig?.axisConfig?.showYAxis ?? true,
        xTicks: 6,
        yTicks: 5,
        yTickFormat: '~s',
        showGrid: props.lineConfig?.axisConfig?.gridEnabled ?? true,
        tooltip: props.lineConfig?.interactionConfig?.tooltipEnabled ?? true,
        tooltipFormat: (d: any) => {
          const val = d[yKey];
          const series = seriesField ? d[seriesField] : undefined;
          const parts = [series !== undefined ? `<div><strong>${String(series)}</strong></div>` : '', `<div>Value: ${val}</div>`];
          return parts.join('');
        },
        showPoints: props.lineConfig?.pointStyle?.showPoints ?? true,
        pointRadius: props.lineConfig?.pointStyle?.radius ?? 3,
        hoverColor: '#1d4ed8',
        animate: true,
        duration: 800,
      };

      const lineRows = filteredRows.value;
      lineChart = createLineChart(frameRef.value, lineRows, cfg);
      status.value = "Rendered line chart";
    } else if (props.spec.type === "area") {
      // Hide the bar SVG and render area into the frame container
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container for area chart");

      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const cfg: any = {
        xKey,
        yKey,
        xType: 'time',
        xParseFormat: '%Y-%m-%d',
        yType: 'linear',
        width,
        height,
        margin: { top: 24, right: 24, bottom: 40, left: 52 },
        responsive: true,
        backgroundColor: props.spec.style?.background || 'transparent',
        yNice: true,
        padding: 0.5,
        areaColor: props.areaConfig?.areaStyle?.fillColor || '#2563eb',
        areaOpacity: props.areaConfig?.areaStyle?.fillOpacity || 0.24,
        strokeColor: '#1d4ed8',
        strokeWidth: 2,
        curveType: 'linear',
        showXAxis: props.areaConfig?.axisConfig?.showXAxis ?? true,
        showYAxis: props.areaConfig?.axisConfig?.showYAxis ?? true,
        xTicks: 6,
        yTicks: 5,
        showGrid: props.areaConfig?.axisConfig?.gridEnabled ?? true,
        tooltip: props.areaConfig?.interactionConfig?.tooltipEnabled ?? true,
        showPoints: true,
        pointRadius: 3,
        pointColor: '#1d4ed8',
        pointStroke: '#ffffff',
        hoverLine: true,
        hoverColor: '#94a3b8',
        focusCircle: true,
        animate: true,
        duration: 800,
      };

      const areaRows = filteredRows.value;
      areaChart = drawAreaChart(frameRef.value, areaRows, cfg);
      status.value = "Rendered area chart";
    } else if (props.spec.type === "dotDonut") {
      svg.style.display = "block";
      const seriesField = props.spec.encoding.series?.field;
      let renderRows = filteredRows.value;
      if (seriesField && props.selectedYears && props.selectedYears.length) {
        renderRows = renderRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
      }
      renderDotDonutChart(svg, props.spec, renderRows, props.dotDonutConfig);
      status.value = "Rendered dot donut chart";
    } else if (props.spec.type === "pie") {
      svg.style.display = "block";
      renderPieDonutChart(svg, props.spec, filteredRows.value, props.pieConfig);
      status.value = "Rendered pie chart";
    } else if (props.spec.type === "scatter") {
      svg.style.display = "block";
      renderScatterPlot(svg, props.spec, filteredRows.value, props.scatterConfig);
      status.value = "Rendered scatter plot";
    } else if (props.spec.type === "map") {
      svg.style.display = "block";
      renderAfricaMap(svg, props.spec, filteredRows.value, props.mapConfig);
      status.value = "Rendered map";
    } else if (props.spec.type === "bubble") {
      svg.style.display = "block";
      renderBubbleChart(svg, props.spec, filteredRows.value, props.bubbleConfig);
      status.value = "Rendered bubble chart";
    } else if (props.spec.type === "stackedBar") {
      svg.style.display = "block";
      renderStackedBarChart(svg, props.spec, filteredRows.value, props.stackedBarConfig);
      status.value = "Rendered stacked bar chart";
    } else if (props.spec.type === "orbitDonut") {
      svg.style.display = "block";
      renderOrbitDonutChart(svg, props.spec, filteredRows.value, props.orbitDonutConfig);
      status.value = "Rendered orbit donut chart";
    } else if (props.spec.type === "stackedArea") {
      // Stacked Area uses drawAreaChart but with stackConfig
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container");
      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const cfg: any = {
        xKey,
        yKey,
        xType: 'time',
        width,
        height,
        margin: { top: 24, right: 24, bottom: 40, left: 52 },
        areaOpacity: props.stackedAreaConfig?.areaStyle?.fillOpacity || 0.6,
        curveType: props.stackedAreaConfig?.areaStyle?.curveType || 'linear',
        showXAxis: props.stackedAreaConfig?.axisConfig?.showXAxis ?? true,
        showYAxis: props.stackedAreaConfig?.axisConfig?.showYAxis ?? true,
        showGrid: props.stackedAreaConfig?.axisConfig?.gridEnabled ?? true,
        tooltip: props.stackedAreaConfig?.interactionConfig?.tooltipEnabled ?? true,
        animate: true,
        duration: 800,
        stack: true, // Internal flag for the renderer if supported
      };
      const areaRows = filteredRows.value;
      areaChart = drawAreaChart(frameRef.value, areaRows, cfg);
      status.value = "Rendered stacked area chart";
    } else {
      status.value = `Type ${props.spec.type} not yet wired`;
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : String(err);
    status.value = "";
  }
}

onMounted(() => {
  // Initial fetch on mount
  loadAndRender();
});

// Spec changes (type/layout/encoding) should only re-render with current rows
watch(
  () => props.spec,
  () => {
    renderWithCurrentRows();
  },
  { deep: true }
);

// When the layout preset changes (e.g., single → horizontal/vertical),
// force a full redraw so axes/grid re-render appropriately.
watch(
  () => props.spec.layout?.preset,
  () => {
    renderWithCurrentRows();
  }
);

watch(
  () => props.barConfig,
  () => {
    renderWithCurrentRows();
  },
  { deep: true }
);

watch(
  () => props.lineConfig,
  () => {
    renderWithCurrentRows();
  },
  { deep: true }
);

watch(
  () => props.areaConfig,
  () => {
    renderWithCurrentRows();
  },
  { deep: true }
);

// Only re-fetch when the bound data source changes
watch(
  () => props.spec.data?.query?.source,
  () => {
    loadAndRender();
  }
);

// Re-render when year selections change (UI-only)
watch(
  () => props.selectedYears,
  () => {
    renderWithCurrentRows();
  },
  { deep: true }
);



function selectCell(rowIndex: number, column: string) {
  selectedRow.value = rowIndex;
  selectedColumn.value = column;
  editValue.value = String((rows.value[rowIndex] as any)[column] ?? "");
}

function renderWithCurrentRows() {
  if (!svgRef.value) return;
  if (props.spec.type === "bar") {
    const seriesField = props.spec.encoding.series?.field;
    let renderRows = filteredRows.value;
    if (seriesField && props.selectedYears && props.selectedYears.length) {
      renderRows = renderRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
    }
    renderBarChart(svgRef.value, props.spec, renderRows, { ...props.barConfig, numberFormat: props.barConfig?.numberFormat ?? '~s' });
  } else if (props.spec.type === "line" && frameRef.value) {
    if (lineChart) { lineChart.destroy(); lineChart = null; }
    const xKey = props.spec.encoding.category.field;
    const yKey = props.spec.encoding.value.field;
    const cfg: LineChartConfig = {
      xKey,
      yKey,
      xType: props.lineConfig?.xType ?? 'time',
      xFormat: props.lineConfig?.xFormat ?? '%Y-%m-%d',
      yType: 'linear',
      width: props.spec.layout?.width ?? 720,
      height: props.spec.layout?.height ?? 420,
      margin: props.lineConfig?.margin ?? { top: 24, right: 24, bottom: 40, left: 52 },
      lineColor: props.lineConfig?.lineColor ?? '#2563eb',
      lineWidth: props.lineConfig?.lineWidth ?? 2,
      curveType: props.lineConfig?.curveType ?? 'linear',
      showXAxis: props.lineConfig?.showXAxis ?? true,
      showYAxis: props.lineConfig?.showYAxis ?? true,
      xTicks: props.lineConfig?.xTicks ?? 6,
      yTicks: props.lineConfig?.yTicks ?? 5,
      xTickFormat: props.lineConfig?.xTickFormat,
      yTickFormat: props.lineConfig?.yTickFormat ?? '~s',
      showGrid: props.lineConfig?.showGrid ?? true,
      tooltip: props.lineConfig?.tooltip ?? true,
      showPoints: props.lineConfig?.showPoints ?? true,
      pointRadius: props.lineConfig?.pointRadius ?? 3,
      hoverColor: props.lineConfig?.hoverColor ?? '#1d4ed8',
      animate: props.lineConfig?.animate ?? true,
      duration: props.lineConfig?.duration ?? 800,
      yDomain: props.lineConfig?.yDomain,
    };
    let lineRows = filteredRows.value;
    const seriesField = props.spec.encoding.series?.field;
    if (seriesField && props.selectedYears && props.selectedYears.length) {
      lineRows = lineRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
    }
    lineChart = createLineChart(frameRef.value, lineRows, cfg);
  } else if (props.spec.type === "area" && frameRef.value) {
    if (areaChart) { areaChart.destroy(); areaChart = null; }
    const xKey = props.spec.encoding.category.field;
    const yKey = props.spec.encoding.value.field;
    const cfg: AreaChartConfig = {
      xKey,
      yKey,
      xType: props.areaConfig?.xType ?? 'time',
      xParseFormat: props.areaConfig?.xParseFormat ?? '%Y-%m-%d',
      yType: 'linear',
      width: props.spec.layout?.width ?? 720,
      height: props.spec.layout?.height ?? 420,
      margin: props.areaConfig?.margin ?? { top: 24, right: 24, bottom: 40, left: 52 },
      responsive: true,
      backgroundColor: props.spec.style?.background || 'transparent',
      xDomain: props.areaConfig?.xDomain,
      yDomain: props.areaConfig?.yDomain,
      yNice: true,
      padding: props.areaConfig?.padding ?? 0.5,
      areaColor: props.areaConfig?.areaColor ?? '#2563eb',
      areaOpacity: props.areaConfig?.areaOpacity ?? 0.24,
      strokeColor: props.areaConfig?.strokeColor ?? '#1d4ed8',
      strokeWidth: props.areaConfig?.strokeWidth ?? 2,
      curveType: props.areaConfig?.curveType ?? 'linear',
      defined: props.areaConfig?.defined,
      showXAxis: props.areaConfig?.showXAxis ?? true,
      showYAxis: props.areaConfig?.showYAxis ?? true,
      xTicks: props.areaConfig?.xTicks ?? 6,
      yTicks: props.areaConfig?.yTicks ?? 5,
      xTickFormat: props.areaConfig?.xTickFormat,
      yTickFormat: props.areaConfig?.yTickFormat ?? '~s',
      axisColor: props.areaConfig?.axisColor ?? '#cbd5e1',
      showGrid: props.areaConfig?.showGrid ?? true,
      gridColor: props.areaConfig?.gridColor ?? '#e2e8f0',
      showPoints: props.areaConfig?.showPoints ?? true,
      pointRadius: props.areaConfig?.pointRadius ?? 3,
      pointColor: props.areaConfig?.pointColor ?? '#1d4ed8',
      pointStroke: props.areaConfig?.pointStroke ?? '#ffffff',
      tooltip: props.areaConfig?.tooltip ?? true,
      tooltipFormat: props.areaConfig?.tooltipFormat ?? ((d: any) =>d[yKey]),
      hoverLine: props.areaConfig?.hoverLine ?? true,
      hoverColor: props.areaConfig?.hoverColor ?? '#94a3b8',
      focusCircle: props.areaConfig?.focusCircle ?? true,
      animate: props.areaConfig?.animate ?? true,
      duration: props.areaConfig?.duration ?? 800,
      easing: undefined,
      sortData: props.areaConfig?.sortData ?? false,
    };
    let areaRows = filteredRows.value;
    const seriesField = props.spec.encoding.series?.field;
    if (seriesField && props.selectedYears && props.selectedYears.length) {
      areaRows = areaRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
    }
    areaChart = drawAreaChart(frameRef.value, areaRows, cfg);
  } else if (props.spec.type === "dotDonut" && svgRef.value) {
    const seriesField = props.spec.encoding.series?.field;
    let renderRows = filteredRows.value;
    if (seriesField && props.selectedYears && props.selectedYears.length) {
      renderRows = renderRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
    }
    renderDotDonutChart(svgRef.value, props.spec, renderRows, props.dotDonutConfig);
  } else if (props.spec.type === "pie" && svgRef.value) {
    renderPieDonutChart(svgRef.value, props.spec, filteredRows.value, props.pieConfig);
  } else if (props.spec.type === "scatter" && svgRef.value) {
    renderScatterPlot(svgRef.value, props.spec, filteredRows.value, props.scatterConfig);
  } else if (props.spec.type === "map" && svgRef.value) {
    renderAfricaMap(svgRef.value, props.spec, filteredRows.value, props.mapConfig);
  } else if (props.spec.type === "bubble" && svgRef.value) {
    renderBubbleChart(svgRef.value, props.spec, filteredRows.value, props.bubbleConfig);
  } else if (props.spec.type === "stackedBar" && svgRef.value) {
    renderStackedBarChart(svgRef.value, props.spec, filteredRows.value, props.stackedBarConfig);
  } else if (props.spec.type === "orbitDonut" && svgRef.value) {
    renderOrbitDonutChart(svgRef.value, props.spec, filteredRows.value, props.orbitDonutConfig);
  }
}

defineExpose({
  rows,
  getSvgEl: () => {
    if (props.spec.type === 'line' || props.spec.type === 'area') {
      return frameRef.value?.querySelector('svg') as SVGSVGElement | null;
    }
    return svgRef.value;
  },
  reload: loadAndRender,
});

onBeforeUnmount(() => {
  if (lineChart) lineChart.destroy();
  if (areaChart) areaChart.destroy();
});
</script>

<template>
  <section class="preview">
    <header class="preview__header">
      <div class="preview__info">
        <h2 class="preview__title">{{ spec.title || "Untitled Chart" }}</h2>
        <p class="preview__subtitle">Live preview • {{ spec.type.charAt(0).toUpperCase() + spec.type.slice(1) }}</p>
      </div>
      <div class="preview__header-actions">
        <div class="preview__palette">
          <span v-for="(color, idx) in spec.style?.palette?.slice(0, 5) ?? []" :key="idx" class="palette-dot" :style="{ backgroundColor: color }"></span>
        </div>
        <button 
          type="button" 
          class="preview__refresh-btn btn btn--sm btn--primary" 
          @click="loadAndRender"
        >
          <svg class="icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 2v6h-6M3 12a9 9 0 0 1 15-6.7L21 8M3 22v-6h6M21 12a9 9 0 0 1-15 6.7L3 16" />
          </svg>
          <span>Refresh Preview</span>
        </button>
      </div>
    </header>

    <div class="preview__surface">
      <div class="preview__status-bar" v-if="status || error">
        <p v-if="status" class="status-text">{{ status }}</p>
        <p v-if="error" class="alert-text">{{ error }}</p>
      </div>


      <div 
        class="preview__frame-wrapper"
        :style="{ 
          width: (spec.layout?.width || 720) + 'px', 
          height: (spec.layout?.height || 420) + 'px' 
        }"
      >
        <div 
          class="preview__frame" 
          ref="frameRef"
          :style="{ backgroundColor: spec.style?.background || '#ffffff' }"
        >
          <svg 
            ref="svgRef" 
            :width="spec.layout?.width ?? 720" 
            :height="spec.layout?.height ?? 420"
          ></svg>
        </div>
      </div>
    </div>

    <div class="preview__footer" v-if="lastValidated">
      <p class="status">{{ lastValidated }}</p>
    </div>

    <section class="panel" style="margin-top: 16px;">
      <header class="panel__header">
        <div>
          <p class="eyebrow">Data</p>
          <h3 class="panel__title">Preview & edit</h3>
          <p class="muted">Click a cell to edit; changes immediately re-render the chart.</p>
        </div>
      </header>

      <div
        class="form-grid"
        style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 8px; position: sticky; top: 0; z-index: 5; background: white; padding-top: 8px; padding-bottom: 8px;"
      >
        <label class="form-field">
          <span>X axis (category)</span>
          <select v-model="mapping.category">
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Y axis (value)</span>
          <select v-model="mapping.value">
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </label>
        <label class="form-field">
          <span>Series (optional)</span>
          <select v-model="mapping.series">
            <option :value="undefined">None</option>
            <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
          </select>
        </label>
      </div>
      <div class="data-table" v-if="columns.length" style="margin-top: 12px; overflow:auto; max-height: 700px; border: 1px solid #e2e8f0; border-radius: 8px; position: relative;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="position: sticky; top: 0; z-index: 6; background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0;">#</th>
              <th v-for="col in columns" :key="col" style="position: sticky; top: 0; z-index: 6; background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0;">
                <span>{{ col }}</span>
                <span style="position: relative; display: inline-block;">
                  <button
                    class="pill"
                    type="button"
                    style="margin-left: 6px; padding: 2px 6px; font-size: 12px;"
                    :class="{ 'pill--active': isColFiltered(col) }"
                    @click.stop="openValueFilter(col, $event)"
                    title="Filter column"
                  >
                    {{ isColFiltered(col) ? 'Filter*' : 'Filter' }}
                  </button>
                  <div
                    v-if="openFilterCol === col"
                    :style="{
                      position: 'absolute',
                      zIndex: 60,
                      top: 'calc(100% + 6px)',
                      left: '0px',
                      background: 'white',
                      border: '1px solid #e2e8f0',
                      borderRadius: '6px',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.12)',
                      width: '280px',
                      padding: '8px'
                    }"
                  >
                    <div class="form-field">
                      <span style="font-size:12px; color:#64748b">Search</span>
                      <input type="text" v-model="valueFilterSearch" placeholder="Search values" />
                    </div>
                    <div style="max-height: 220px; overflow:auto; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; margin-top: 6px;">
                      <label style="display:flex; align-items:center; gap:8px; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                        <input type="checkbox" :checked="tempSelection.size === uniqueValuesFor(col).length" @change="toggleTempAll(($event.target as HTMLInputElement).checked)" />
                        <span>(Select All)</span>
                      </label>
                      <label v-for="val in visibleFilterValues" :key="val" style="display:flex; align-items:center; gap:8px; padding: 4px 0;">
                        <input type="checkbox" :checked="tempSelection.has(val)" @change="toggleTempValue(val, ($event.target as HTMLInputElement).checked)" />
                        <span>{{ val }}</span>
                      </label>
                    </div>
                    <div class="pill-group" style="margin-top: 8px; display:flex; justify-content: flex-end; gap: 8px;">
                      <button class="pill" type="button" @click.stop="clearValueFilter(col)">Clear</button>
                      <button class="pill" type="button" @click.stop="openFilterCol = null">Cancel</button>
                      <button class="pill" type="button" @click.stop="applyValueFilter">OK</button>
                    </div>
                  </div>
                </span>
              </th>
            </tr>
            
          </thead>
          <tbody>
            <tr
              v-for="({ row, index: originalIndex }, rIdx) in filteredRowsWithIndex"
              :key="originalIndex"
              :style="{ background: selectedRow === originalIndex ? '#eef2ff' : 'white' }"
            >
              <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #94a3b8;">{{ rIdx + 1 }}</td>
              <td
                v-for="col in columns"
                :key="col"
                style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; cursor: pointer;"
                @click="selectCell(originalIndex, col)"
              >
                {{ (row as any)[col] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="columns.length" style="padding-top: 12px; border-top: 1px solid #f1f5f9; margin-top: 8px;">
        <p class="muted">Showing all {{ totalFiltered }} rows</p>
      </div>
      <p v-else class="muted">No rows loaded yet.</p>
    </section>
  </section>
</template>

<style scoped>
.preview {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.preview__header {
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #f8fafc;
}

.preview__title {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.preview__subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 4px 0 0 0;
}

.preview__palette {
  display: flex;
  gap: 6px;
}
.palette-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.preview__surface {
  flex: 1;
  padding: 40px;
  background: #f1f5f9;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}

.preview__header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preview__status-bar {
  margin-bottom: 12px;
}
.status-text {
  font-size: 12px;
  color: #0ea5e9;
  margin: 0;
}
.alert-text {
  font-size: 12px;
  color: #ef4444;
  margin: 0;
}

.preview__frame-wrapper {
  flex: 0 0 auto;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
}

.preview__frame {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview__footer {
  padding: 12px 24px;
  border-top: 1px solid #f1f5f9;
  background: #f8fafc;
}
.status {
  font-size: 11px;
  color: #94a3b8;
  margin: 0;
}

.data-table {
  background: white;
}
</style>
