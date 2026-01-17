<script setup lang="ts">
import { onMounted, ref, watch, nextTick, onBeforeUnmount, computed } from "vue";
import type { ChartSpec } from "../specs/chartSpec";
import { renderBarChart, type BuilderBarConfig } from "../charts/bar";
import { createLineChart, type LineChartConfig, type LineChartInstance } from "../charts/line";
import { drawAreaChart, type AreaChartConfig, type AreaChartInstance } from "../charts/areaV7";

const props = defineProps<{
  spec: ChartSpec;
  lastValidated?: string;
  barConfig?: BuilderBarConfig;
  lineConfig?: Partial<LineChartConfig>;
  areaConfig?: Partial<AreaChartConfig>;
  selectedYears?: string[];
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "update:fields", payload: string[]): void;
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
const editValue = ref<string>("");
const newColumnName = ref<string>("");
const renameFrom = ref<string>("");
const renameTo = ref<string>("");
const maxPreviewRows = 50;

const columns = computed(() => rows.value.length ? Object.keys(rows.value[0]) : []);

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
      let renderRows = rows.value;
      if (seriesField && props.selectedYears && props.selectedYears.length) {
        renderRows = renderRows.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
      }
      renderBarChart(svg, props.spec, renderRows, props.barConfig);
      status.value = "Rendered bar chart";
    } else if (props.spec.type === "line") {
      // Hide the bar SVG and render line into the frame container
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container for line chart");

      // Build a config mapping from spec when possible; allow overrides from lineConfig
      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const seriesField = props.spec.encoding.series?.field;
      if (seriesField && props.selectedYears && props.selectedYears.length) {
        rows.value = rows.value.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
      }
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
        yTickFormat: props.lineConfig?.yTickFormat,
        showGrid: props.lineConfig?.showGrid ?? true,
        tooltip: props.lineConfig?.tooltip ?? true,
        showPoints: props.lineConfig?.showPoints ?? true,
        pointRadius: props.lineConfig?.pointRadius ?? 3,
        hoverColor: props.lineConfig?.hoverColor ?? '#1d4ed8',
        animate: props.lineConfig?.animate ?? true,
        duration: props.lineConfig?.duration ?? 800,
        yDomain: props.lineConfig?.yDomain,
      };

      lineChart = createLineChart(frameRef.value, rows.value, cfg);
      status.value = "Rendered line chart";
    } else if (props.spec.type === "area") {
      // Hide the bar SVG and render area into the frame container
      svg.style.display = "none";
      if (!frameRef.value) throw new Error("No frame container for area chart");

      const xKey = props.spec.encoding.category.field;
      const yKey = props.spec.encoding.value.field;
      const seriesField = props.spec.encoding.series?.field;
      if (seriesField && props.selectedYears && props.selectedYears.length) {
        rows.value = rows.value.filter((r: any) => props.selectedYears!.includes(String(r[seriesField])));
      }
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
        yTickFormat: props.areaConfig?.yTickFormat,
        axisColor: props.areaConfig?.axisColor ?? '#cbd5e1',
        showGrid: props.areaConfig?.showGrid ?? true,
        gridColor: props.areaConfig?.gridColor ?? '#e2e8f0',
        showPoints: props.areaConfig?.showPoints ?? true,
        pointRadius: props.areaConfig?.pointRadius ?? 3,
        pointColor: props.areaConfig?.pointColor ?? '#1d4ed8',
        pointStroke: props.areaConfig?.pointStroke ?? '#ffffff',
        tooltip: props.areaConfig?.tooltip ?? true,
        tooltipFormat: props.areaConfig?.tooltipFormat,
        hoverLine: props.areaConfig?.hoverLine ?? true,
        hoverColor: props.areaConfig?.hoverColor ?? '#94a3b8',
        focusCircle: props.areaConfig?.focusCircle ?? true,
        animate: props.areaConfig?.animate ?? true,
        duration: props.areaConfig?.duration ?? 800,
        easing: undefined,
        sortData: props.areaConfig?.sortData ?? false,
      };

      areaChart = drawAreaChart(frameRef.value, rows.value, cfg);
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
  loadAndRender();
});

watch(
  () => props.spec,
  () => {
    loadAndRender();
  },
  { deep: true }
);

watch(
  () => props.barConfig,
  () => {
    loadAndRender();
  },
  { deep: true }
);

watch(
  () => props.lineConfig,
  () => {
    loadAndRender();
  },
  { deep: true }
);

watch(
  () => props.areaConfig,
  () => {
    loadAndRender();
  },
  { deep: true }
);

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
  if (props.spec.type === "bar") {
    renderBarChart(svgRef.value, props.spec, rows.value, props.barConfig);
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
      yTickFormat: props.lineConfig?.yTickFormat,
      showGrid: props.lineConfig?.showGrid ?? true,
      tooltip: props.lineConfig?.tooltip ?? true,
      showPoints: props.lineConfig?.showPoints ?? true,
      pointRadius: props.lineConfig?.pointRadius ?? 3,
      hoverColor: props.lineConfig?.hoverColor ?? '#1d4ed8',
      animate: props.lineConfig?.animate ?? true,
      duration: props.lineConfig?.duration ?? 800,
      yDomain: props.lineConfig?.yDomain,
    };
    lineChart = createLineChart(frameRef.value, rows.value, cfg);
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
      yTickFormat: props.areaConfig?.yTickFormat,
      axisColor: props.areaConfig?.axisColor ?? '#cbd5e1',
      showGrid: props.areaConfig?.showGrid ?? true,
      gridColor: props.areaConfig?.gridColor ?? '#e2e8f0',
      showPoints: props.areaConfig?.showPoints ?? true,
      pointRadius: props.areaConfig?.pointRadius ?? 3,
      pointColor: props.areaConfig?.pointColor ?? '#1d4ed8',
      pointStroke: props.areaConfig?.pointStroke ?? '#ffffff',
      tooltip: props.areaConfig?.tooltip ?? true,
      tooltipFormat: props.areaConfig?.tooltipFormat,
      hoverLine: props.areaConfig?.hoverLine ?? true,
      hoverColor: props.areaConfig?.hoverColor ?? '#94a3b8',
      focusCircle: props.areaConfig?.focusCircle ?? true,
      animate: props.areaConfig?.animate ?? true,
      duration: props.areaConfig?.duration ?? 800,
      easing: undefined,
      sortData: props.areaConfig?.sortData ?? false,
    };
    areaChart = drawAreaChart(frameRef.value, rows.value, cfg);
  }
}

defineExpose({
  getSvgEl: () => {
    if (props.spec.type === 'bar') return svgRef.value;
    return frameRef.value?.querySelector('svg') as SVGSVGElement | null;
  },
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
        <p class="muted">Rendering powered by D3; UI stays framework-only.</p>
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
        <div>
          <p class="label">Data</p>
          <p class="value">{{ spec.data.provider }} · {{ spec.data.query.source }}</p>
        </div>
      </div>
      <div class="preview__frame" ref="frameRef">
        <svg ref="svgRef"></svg>
      </div>
      <p class="muted" v-if="status">{{ status }}</p>
      <p class="alert" v-if="error">{{ error }}</p>
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

      <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));">
        <div class="form-field">
          <span>Selected cell</span>
          <p class="muted" v-if="selectedRow === null || !selectedColumn">None</p>
          <p v-else class="muted">Row {{ selectedRow + 1 }}, {{ selectedColumn }}</p>
          <input
            type="text"
            :value="editValue"
            @input="editValue = ($event.target as HTMLInputElement).value"
            :disabled="selectedRow === null || !selectedColumn"
          />
          <button class="pill" type="button" :disabled="selectedRow === null || !selectedColumn" @click="saveCell">Save cell</button>
        </div>

        <div class="form-field">
          <span>Add column</span>
          <input type="text" placeholder="new column" v-model="newColumnName" />
          <button class="pill" type="button" @click="addColumn">Add column</button>
        </div>

        <div class="form-field">
          <span>Rename column</span>
          <input type="text" placeholder="from" v-model="renameFrom" />
          <input type="text" placeholder="to" style="margin-top:6px" v-model="renameTo" />
          <button class="pill" type="button" @click="renameColumnAction">Rename</button>
        </div>

        <div class="form-field">
          <span>Rows</span>
          <div class="pill-group">
            <button class="pill" type="button" @click="addRow">Add row</button>
            <button class="pill" type="button" :disabled="selectedRow === null" @click="deleteSelectedRow">Delete selected</button>
          </div>
        </div>
      </div>

      <div class="data-table" v-if="columns.length" style="margin-top: 12px; overflow:auto; max-height: 360px; border: 1px solid #e2e8f0; border-radius: 8px;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr>
              <th style="position: sticky; top: 0; background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0;">#</th>
              <th v-for="col in columns" :key="col" style="position: sticky; top: 0; background: #f8fafc; text-align: left; padding: 8px; border-bottom: 1px solid #e2e8f0;">
                {{ col }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="(row, rIdx) in rows.slice(0, maxPreviewRows)"
              :key="rIdx"
              :style="{ background: selectedRow === rIdx ? '#eef2ff' : 'white' }"
            >
              <td style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; color: #94a3b8;">{{ rIdx + 1 }}</td>
              <td
                v-for="col in columns"
                :key="col"
                style="padding: 6px 8px; border-bottom: 1px solid #f1f5f9; cursor: pointer;"
                @click="selectCell(rIdx, col)"
              >
                {{ (row as any)[col] }}
              </td>
            </tr>
          </tbody>
        </table>
        <p class="muted" style="padding:8px" v-if="rows.length > maxPreviewRows">Showing first {{ maxPreviewRows }} of {{ rows.length }} rows.</p>
      </div>
      <p v-else class="muted">No rows loaded yet.</p>
    </section>
  </section>
</template>
