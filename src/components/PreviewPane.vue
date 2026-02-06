<script setup lang="ts">
import { onMounted, ref, watch, nextTick, onBeforeUnmount, computed, reactive } from "vue";
import * as XLSX from 'xlsx';
import type { ChartSpec } from "../specs/chartSpec";
import { renderBarChart, type BuilderBarConfig } from "../charts/bar";
import { createLineChart, type LineChartConfig, type LineChartInstance } from "../charts/line";
import { drawAreaChart, type AreaChartConfig, type AreaChartInstance } from "../charts/areaV7";
import { renderBubbleChart } from "../charts/bubble";
import { renderDotDonutChart } from "../charts/dotDonut";
import { renderOrbitDonutChart } from "../charts/orbitDonut";
import { renderPieDonutChart, type PieConfig } from "../charts/pie";

const props = defineProps<{
  spec: ChartSpec;
  lastValidated?: string;
  barConfig?: BuilderBarConfig;
  lineConfig?: Partial<LineChartConfig>;
  areaConfig?: Partial<AreaChartConfig>;
  pieConfig?: PieConfig;
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
const newColumnName = ref<string>("");
const renameFrom = ref<string>("");
const renameTo = ref<string>("");
const page = ref<number>(1);
const pageSize = ref<number>(25);
const pageSizeOptions = [10, 25, 50, 100];
// Excel-like value filters per column
const valueFilterSelections = reactive({} as Record<string, Set<string> | null>);
const openFilterCol = ref<string | null>(null);
const filterPosition = ref<{ top: number; left: number }>({ top: 0, left: 0 });
const valueFilterSearch = ref<string>("");
const tempSelection = ref<Set<string>>(new Set());

const columns = computed(() => rows.value.length ? Object.keys(rows.value[0]) : []);

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
  page.value = 1;
}, { immediate: true });

watch(columns, (cols) => {
  // prune any value filters for columns that no longer exist
  Object.keys(valueFilterSelections).forEach(key => { if (!cols.includes(key)) delete valueFilterSelections[key]; });
  page.value = 1;
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

function humanizeValue(val: unknown): string {
  const num = Number(val);
  if (!Number.isFinite(num)) return String(val ?? "");
  const abs = Math.abs(num);
  const format = (n: number, suffix: string) => `${+(n.toFixed(1))}${suffix}`;
  if (abs >= 1_000_000_000) return format(num / 1_000_000_000, 'B');
  if (abs >= 1_000_000) return format(num / 1_000_000, 'M');
  if (abs >= 1_000) return format(num / 1_000, 'K');
  return `${num}`;
}

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
  page.value = 1;
}

function clearValueFilter(col?: string) {
  const key = col ?? openFilterCol.value ?? undefined;
  if (!key) return;
  valueFilterSelections[key] = null;
  if (!col) openFilterCol.value = null;
  page.value = 1;
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
const totalPages = computed(() => {
  const total = Math.ceil(totalFiltered.value / pageSize.value) || 1;
  return Math.max(1, total);
});
const pageStart = computed(() => (page.value - 1) * pageSize.value);
const pageEnd = computed(() => pageStart.value + pageSize.value);
const pagedRows = computed(() => filteredRowsWithIndex.value.slice(pageStart.value, pageEnd.value));
const showingStart = computed(() => totalFiltered.value ? pageStart.value + 1 : 0);
const showingEnd = computed(() => Math.min(totalFiltered.value, pageEnd.value));

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

    // Enforce a consistent preview frame size for all chart types
    if (frameRef.value) {
      frameRef.value.style.width = `${width}px`;
      frameRef.value.style.height = `${height}px`;
    }

    // Always size the built-in SVG; hidden for non-bar types
    const svg = svgRef.value;
    if (svg) {
      svg.setAttribute("width", String(width));
      svg.setAttribute("height", String(height));
      svg.style.width = '100%';
      svg.style.height = '100%';
    }

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
    } else if (props.spec.type === 'bubble') {
      svg.style.display = 'block';
      renderBubbleChart(svg, props.spec, filteredRows.value || []);
      status.value = 'Rendered bubble chart';
    } else if (props.spec.type === 'dotDonut') {
      svg.style.display = 'block';
      renderDotDonutChart(svg, props.spec, filteredRows.value || []);
      status.value = 'Rendered dot donut chart';
    } else if (props.spec.type === 'orbitDonut') {
      svg.style.display = 'block';
      renderOrbitDonutChart(svg, props.spec, filteredRows.value || []);
      status.value = 'Rendered orbit donut chart';
    } else if (props.spec.type === 'pie') {
      svg.style.display = 'block';
      renderPieDonutChart(svg, props.spec, filteredRows.value || [], props.pieConfig);
      status.value = 'Rendered pie chart';
    } else if (props.spec.type === "line") {
      // Hide the bar SVG and render line into the frame container
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container for line chart");

      // Build a config mapping from spec when possible; allow overrides from lineConfig
      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const seriesField = props.spec.encoding.series?.field;
      const cfg: LineChartConfig = {
        xKey,
        yKey,
        xType: props.lineConfig?.xType ?? 'time',
        xFormat: props.lineConfig?.xFormat ?? '%Y-%m-%d',
        yType: 'linear',
        width,
        height,
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
        tooltipFormat: props.lineConfig?.tooltipFormat ?? ((d: any) => {
          const val = d[yKey];
          const series = seriesField ? d[seriesField] : undefined;
          const parts = [series !== undefined ? `<div><strong>${String(series)}</strong></div>` : '', `<div>Value: ${val}</div>`];
          return parts.join('');
        }),
        showPoints: props.lineConfig?.showPoints ?? true,
        pointRadius: props.lineConfig?.pointRadius ?? 3,
        hoverColor: props.lineConfig?.hoverColor ?? '#1d4ed8',
        animate: props.lineConfig?.animate ?? true,
        duration: props.lineConfig?.duration ?? 800,
        yDomain: props.lineConfig?.yDomain,
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
      const seriesField = props.spec.encoding.series?.field;
      const cfg: AreaChartConfig = {
        xKey,
        yKey,
        xType: props.areaConfig?.xType ?? 'time',
        xParseFormat: props.areaConfig?.xParseFormat ?? '%Y-%m-%d',
        yType: 'linear',
        width,
        height,
        margin: props.areaConfig?.margin ?? { top: 24, right: 24, bottom: 40, left: 52 },
        responsive: true,
        backgroundColor: undefined,
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
        tooltipFormat: props.areaConfig?.tooltipFormat ?? ((d: any) => {
          const val = d[yKey];
          const series = seriesField ? d[seriesField] : undefined;
          const parts = [series !== undefined ? `<div><strong>${String(series)}</strong></div>` : '', `<div>Value: ${val}</div>`];
          return parts.join('');
        }),
        hoverLine: props.areaConfig?.hoverLine ?? true,
        hoverColor: props.areaConfig?.hoverColor ?? '#94a3b8',
        focusCircle: props.areaConfig?.focusCircle ?? true,
        animate: props.areaConfig?.animate ?? true,
        duration: props.areaConfig?.duration ?? 800,
        easing: undefined,
        sortData: props.areaConfig?.sortData ?? false,
      };

      const areaRows = filteredRows.value;
      areaChart = drawAreaChart(frameRef.value, areaRows, cfg);
      status.value = "Rendered area chart";
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

watch(
  () => props.pieConfig,
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

watch(totalPages, (next) => {
  if (page.value > next) page.value = next;
});

watch(pageSize, () => {
  page.value = 1;
});

function handleRefresh() {
  emit("refresh");
  loadAndRender();
}

function selectCell(rowIndex: number, column: string) {
  selectedRow.value = rowIndex;
  selectedColumn.value = column;
  editValue.value = String((rows.value[rowIndex] as any)[column] ?? "");
}

function saveCell() {
  if (selectedRow.value === null || !selectedColumn.value) return;
  const row = rows.value[selectedRow.value];
  if (!row) return;
  const raw = editValue.value;
  const asNumber = raw === "" ? "" : Number(raw);
  (row as any)[selectedColumn.value] = Number.isFinite(asNumber) && raw.trim() !== "" ? asNumber : raw;
  renderWithCurrentRows();
}

function addRow() {
  const blank: Record<string, unknown> = {};
  columns.value.forEach(c => { blank[c] = ""; });
  rows.value = [...rows.value, blank];
  renderWithCurrentRows();
}

function deleteSelectedRow() {
  if (selectedRow.value === null) return;
  rows.value = rows.value.filter((_, idx) => idx !== selectedRow.value);
  selectedRow.value = null;
  renderWithCurrentRows();
}

function addColumn() {
  const name = newColumnName.value.trim();
  if (!name || columns.value.includes(name)) return;
  rows.value = rows.value.map(r => ({ ...r, [name]: "" }));
  newColumnName.value = "";
  emit("update:fields", columns.value);
  renderWithCurrentRows();
}




function renameColumnAction() {
  const from = renameFrom.value.trim();
  const to = renameTo.value.trim();
  if (!from || !to || from === to || !columns.value.includes(from)) return;
  rows.value = rows.value.map(r => {
    const { [from]: val, ...rest } = r;
    return { ...rest, [to]: val } as Record<string, unknown>;
  });
  renameFrom.value = "";
  renameTo.value = "";
  emit("update:fields", columns.value);
  renderWithCurrentRows();
}

function renderWithCurrentRows() {
  if (!svgRef.value) return;
  // ensure preview frame size remains consistent when re-rendering
  const enforcedWidth = props.spec.layout?.width ?? 720;
  const enforcedHeight = props.spec.layout?.height ?? 420;
  if (frameRef.value) {
    frameRef.value.style.width = `${enforcedWidth}px`;
    frameRef.value.style.height = `${enforcedHeight}px`;
  }
  if (svgRef.value) {
    svgRef.value.setAttribute('width', String(enforcedWidth));
    svgRef.value.setAttribute('height', String(enforcedHeight));
    svgRef.value.style.width = '100%';
    svgRef.value.style.height = '100%';
  }
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
      backgroundColor: undefined,
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
    } else if (props.spec.type === 'bubble') {
      svgRef.value!.style.display = 'block';
      renderBubbleChart(svgRef.value!, props.spec, filteredRows.value || []);
    } else if (props.spec.type === 'dotDonut') {
      svgRef.value!.style.display = 'block';
      renderDotDonutChart(svgRef.value!, props.spec, filteredRows.value || []);
    } else if (props.spec.type === 'orbitDonut') {
      svgRef.value!.style.display = 'block';
      renderOrbitDonutChart(svgRef.value!, props.spec, filteredRows.value || []);
    } else if (props.spec.type === 'pie') {
      svgRef.value!.style.display = 'block';
      renderPieDonutChart(svgRef.value!, props.spec, filteredRows.value || [], props.pieConfig);
    }
}

defineExpose({
  getSvgEl: () => {
    if (props.spec.type === 'bar' || props.spec.type === 'bubble' || props.spec.type === 'dotDonut' || props.spec.type === 'orbitDonut' || props.spec.type === 'pie') return svgRef.value;
    return frameRef.value?.querySelector('svg') as SVGSVGElement | null;
  },
  reload: loadAndRender,
});

onBeforeUnmount(() => {
  if (lineChart) lineChart.destroy();
  if (areaChart) areaChart.destroy();
});
</script>

<template>
  <section class="panel preview">
    <header class="panel__header">
      <div>
        <p class="eyebrow">Step 3</p>
        <h2 class="panel__title">Live preview</h2>
        <p class="muted">Rendering powered by D3.</p>
      </div>
      <button type="button" class="btn" @click="handleRefresh">Refresh preview</button>
    </header>

    <div class="preview__surface">
        <div class="preview__meta">
          <div>
            <p class="label">Type</p>
            <p class="value">{{ spec.type }}</p>
          </div>
          <div>
            <p class="label">Layout</p>
            <p class="value">{{ spec.layout?.preset ?? 'single' }}</p>
          </div>
        </div>
      <!-- removed global overlay; filter card will be placed inside the data panel -->
      <div class="preview__frame" ref="frameRef">
        <svg ref="svgRef"></svg>
      </div>
      <p class="muted" v-if="status">{{ status }}</p>
      <p class="alert" v-if="error">{{ error }}</p>
    </div>

    <div class="preview__footer" v-if="lastValidated">
      <p class="status">{{ lastValidated }}</p>
    </div>

    <section class="panel w-full" style="margin-top: 16px; position: relative;">
      <header class="panel__header">
        <div>
          <p class="eyebrow">Data</p>
          <h3 class="panel__title">Preview & edit</h3>
          <p class="muted">Filter and changes immediately re-render the chart.</p>
        </div>
      </header>

      <!-- Filter card anchored to the top-left of the data panel -->
      <div v-if="openFilterCol" class="data-panel-filter">
        <div class="data-filter-card">
          <div style="display:flex; gap:12px; align-items:flex-start;">
            <div style="min-width:180px;">
              <label class="form-field">
                <span>Column</span>
                <select v-model="openFilterCol">
                  <option v-for="col in columns" :key="col" :value="col">{{ col }}</option>
                </select>
              </label>
            </div>
            <div style="flex:1;">
              <div class="form-field">
                <span style="font-size:12px; color:#64748b">Search</span>
                <input type="text" v-model="valueFilterSearch" placeholder="Search values" />
              </div>
              <div style="max-height: 220px; overflow:auto; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px; margin-top: 6px; background:white;">
                <label style="display:flex; align-items:center; gap:8px; padding: 4px 0; border-bottom: 1px solid #f1f5f9;">
                  <input type="checkbox" :checked="openFilterCol ? tempSelection.size === uniqueValuesFor(openFilterCol).length : false" @change="toggleTempAll(($event.target as HTMLInputElement).checked)" />
                  <span>(Select All)</span>
                </label>
                <label v-for="val in visibleFilterValues" :key="val" style="display:flex; align-items:center; gap:8px; padding: 4px 0;">
                  <input type="checkbox" :checked="tempSelection.has(val)" @change="toggleTempValue(val, ($event.target as HTMLInputElement).checked)" />
                  <span>{{ val }}</span>
                </label>
              </div>
              <div class="pill-group" style="margin-top: 8px; display:flex; justify-content: flex-end; gap: 8px;">
                <button class="pill" type="button" @click="clearValueFilter(openFilterCol)">Clear</button>
                <button class="pill" type="button" @click="openFilterCol = null">Cancel</button>
                <button class="pill" type="button" @click="applyValueFilter">OK</button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
        <table class="w-full border-collapse">
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
                    v-if="false"
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
              v-for="({ row, index: originalIndex }, rIdx) in pagedRows"
              :key="originalIndex"
              :style="{ background: selectedRow === originalIndex ? '#eef2ff' : 'white' }"
            >
              <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #94a3b8;">{{ pageStart + rIdx + 1 }}</td>
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
      <div v-if="columns.length" class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); align-items: center; gap: 12px; margin-top: 8px;">
        <div class="pill-group">
          <button class="pill" type="button" @click="page = 1" :disabled="page === 1 || !rows.length">« First</button>
          <button class="pill" type="button" @click="page = Math.max(1, page - 1)" :disabled="page === 1 || !rows.length">‹ Prev</button>
          <button class="pill" type="button" @click="page = Math.min(totalPages, page + 1)" :disabled="page === totalPages || !rows.length">Next ›</button>
          <button class="pill" type="button" @click="page = totalPages" :disabled="page === totalPages || !rows.length">Last »</button>
        </div>
        <div>
          <p class="muted">Showing {{ showingStart }}–{{ showingEnd }} of {{ totalFiltered }} rows</p>
        </div>
        <div class="form-field">
          <span>Rows per page</span>
          <select v-model.number="pageSize">
            <option v-for="size in pageSizeOptions" :key="size" :value="size">{{ size }}</option>
          </select>
        </div>
        <div class="form-field">
          <span>Page</span>
          <input type="number" min="1" :max="totalPages" v-model.number="page" />
          <p class="muted">of {{ totalPages }}</p>
        </div>
      </div>
      <p v-else class="muted">No rows loaded yet.</p>
    </section>
  </section>
</template>

<style scoped>
.preview__frame {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  border-radius: 8px;
  overflow: hidden;
  /* allow max-width responsiveness but prefer enforced px size */
  max-width: 100%;
}
.preview__frame svg {
  display: block;
  width: 100%;
  height: 100%;
}

</style>

<style scoped>
.panel.preview { position: relative; }
.global-filter-overlay {
  position: absolute;
  inset: 0;
  z-index: 220;
  pointer-events: none;
}
.global-filter-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.16);
}
.global-filter-card {
  position: absolute;
  top: 8px; /* align to parent view top */
  left: 50%;
  transform: translateX(-50%);
  pointer-events: auto;
  width: min(900px, 96%);
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 12px;
  box-shadow: 0 12px 32px rgba(2,6,23,0.12);
}

/* Filter card anchored to the top-left of the Preview & edit (data) panel */
.data-panel-filter {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 160;
  pointer-events: auto;
  width: min(780px, 92%);
}
.data-filter-card {
  background: #ffffff;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  padding: 12px;
  box-shadow: 0 8px 24px rgba(2,6,23,0.10);
}

</style>
