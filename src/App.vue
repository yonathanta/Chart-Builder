<script setup lang="ts">
import { ref, computed, watch, nextTick } from "vue";
import { chartSpecSchema, type ChartSpec } from "./specs/chartSpec";
import ChartTypeSelector from "./components/ChartTypeSelector.vue";
import ChartOptionsPanel from "./components/ChartOptionsPanel.vue";
import BarBuilderControls from "./components/BarBuilderControls.vue";
import LineBuilderControls from "./components/LineBuilderControls.vue";
import AreaBuilderControls from "./components/AreaBuilderControls.vue";
import DataBindingPanel from "./components/DataBindingPanel.vue";
import PreviewPane from "./components/PreviewPane.vue";
import { exportService, type ExportFormat } from "./export/exportService";
import { computed as vueComputed } from "vue";
import type { LineChartConfig } from "./charts/line";
import type { AreaChartConfig } from "./charts/areaV7";

const spec = ref<ChartSpec>({
  version: "1.0",
  id: "draft-1",
  type: "bar",
  title: "Draft chart",
  data: {
    provider: "json",
    kind: "json",
    query: { source: "/data/sample-bar.json" },
    syncMode: "live",
  },
  encoding: {
    category: { field: "category" },
    value: { field: "value", aggregate: "sum" },
    series: { field: "series" },
  },
  layout: { preset: "single", width: 720, height: 420 },
  style: { palette: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"] },
});

const lastValidated = ref<string | undefined>();
const validationError = ref<string | undefined>();

const barConfig = ref({
  cornerRadius: 4,
  barPadding: 0.2,
  barColor: "#4F81BD",
  animationDuration: 800,
  staggerDelay: 30,
  showGridlines: true,
  showValues: true,
  xLabelOffset: 0,
  xLabelRotation: 0,
  yLabelOffset: 0,
  labelAlignment: 'left',
  separateLabelLine: false,
  valueAlignment: 'right',
  numberFormat: ',.2~f',
  swapLabelsAndValues: false,
  replaceCodesWithFlags: false,
  valueMin: undefined,
  valueMax: undefined,
  customizeColors: false,
  useGradientColors: false,
  gradientLowColor: '#a7f3d0',
  gradientHighColor: '#065f46',
  useValueColors: false,
  lowThreshold: 10,
  highThreshold: 90,
  lowColor: '#a7f3d0',
  midColor: '#34d399',
  highColor: '#065f46',
  separatingLines: false,
  barBackground: false,
  thickerBars: false,
  sortBars: false,
  reverseOrder: false,
  groupBarsByColumn: false,
  overlays: [],
});

const lineConfig = ref<LineChartConfig>({
  xType: 'time',
  xFormat: '%Y-%m-%d',
  lineColor: '#2563eb',
  lineWidth: 2,
  curveType: 'linear',
  showXAxis: true,
  showYAxis: true,
  xTicks: 6,
  yTicks: 5,
  showGrid: true,
  tooltip: true,
  showPoints: true,
  pointRadius: 3,
  hoverColor: '#1d4ed8',
  animate: true,
  duration: 800,
});

const areaConfig = ref<AreaChartConfig>({
  xType: 'time',
  xParseFormat: '%Y-%m-%d',
  areaColor: '#2563eb',
  areaOpacity: 0.24,
  strokeColor: '#1d4ed8',
  strokeWidth: 2,
  curveType: 'linear',
  showXAxis: true,
  showYAxis: true,
  xTicks: 6,
  yTicks: 5,
  showGrid: true,
  tooltip: true,
  showPoints: true,
  pointRadius: 3,
  pointColor: '#1d4ed8',
  pointStroke: '#ffffff',
  hoverLine: true,
  hoverColor: '#94a3b8',
  focusCircle: true,
  animate: true,
  duration: 800,
});

const isValid = computed(() => !validationError.value);

const panelOpen = ref({
  options: false,
  builder: false,
  data: false,
});

const exportFormats: ExportFormat[] = ["svg", "png", "pdf", "html", "spec-json"];

const chevron = vueComputed(() => (open: boolean) => open ? "›" : "›");
const selectedYears = ref<string[]>([]);
const dataFields = ref<string[]>([]);

watch(
  spec,
  (next) => {
    try {
      chartSpecSchema.parse(next);
      validationError.value = undefined;
      lastValidated.value = new Date().toLocaleTimeString();
    } catch (err) {
      validationError.value = err instanceof Error ? err.message : String(err);
    }
  },
  { deep: true, immediate: true }
);

function updateType(type: ChartSpec["type"]) {
  spec.value = { ...spec.value, type };
}

function applyPreset(payload: { type: ChartSpec["type"]; layoutPreset?: "single" | "horizontal" | "vertical" | "grid" | "smallMultiples"; mode?: "grouped" | "stacked" | "percent" | "simple" }) {
  const nextStyle = { ...spec.value.style } as any;
  if (payload.mode) nextStyle.mode = payload.mode;
  const nextLayout = { ...spec.value.layout, preset: payload.layoutPreset ?? spec.value.layout.preset };
  spec.value = { ...spec.value, type: payload.type, style: nextStyle, layout: nextLayout } as ChartSpec;
}

function updateLayout(payload: Partial<ChartSpec["layout"]>) {
  const preset = payload.preset ?? spec.value.layout.preset;
  spec.value = { ...spec.value, layout: { ...spec.value.layout, ...payload, preset } };
}

function updateStyle(payload: Partial<ChartSpec["style"]>) {
  spec.value = { ...spec.value, style: { ...spec.value.style, ...payload } };
}

function updateBinding(binding: ChartSpec["data"]) {
  spec.value = { ...spec.value, data: binding };
}

function updateEncoding(payload: { category: string; value: string; series?: string }) {
  const enc = {
    category: { field: payload.category },
    value: { field: payload.value, aggregate: spec.value.encoding.value.aggregate ?? "sum" },
    series: payload.series ? { field: payload.series } : undefined,
  } as ChartSpec["encoding"];
  spec.value = { ...spec.value, encoding: enc } as ChartSpec;
}

function updateYears(years: string[]) {
  selectedYears.value = years;
}

function updateFields(fields: string[]) {
  dataFields.value = fields;
}

function updateBarConfig(next: typeof barConfig.value) {
  barConfig.value = next;
}

function updateLineConfig(next: Record<string, any>) {
  lineConfig.value = next as LineChartConfig;
}

function updateAreaConfig(next: Record<string, any>) {
  areaConfig.value = next as AreaChartConfig;
}

function refreshPreview() {
}

function onPreviewRefresh() {
  nextTick(() => {
    previewRef.value?.reload?.();
  });
}

const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null);

async function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function handleExport(format: ExportFormat) {
  const svg = previewRef.value?.getSvgEl?.();
  const baseName = (spec.value.title?.trim() || "chart").replace(/\s+/g, "-").toLowerCase();
  const background = spec.value.style?.background;

  try {
    if (format === "svg") {
      if (!svg) throw new Error("No SVG to export");
      const blob = await exportService.exportSVG(svg, { background });
      await downloadBlob(blob, `${baseName}.svg`);
    } else if (format === "png") {
      if (!svg) throw new Error("No SVG to export");
      const blob = await exportService.exportPNG(svg, { background, scale: 2 });
      await downloadBlob(blob, `${baseName}.png`);
    } else if (format === "pdf") {
      if (!svg) throw new Error("No SVG to export");
      const blob = await exportService.exportPDF(svg, { background, page: { orientation: "landscape", size: "a4", marginMm: 10 } });
      await downloadBlob(blob, `${baseName}.pdf`);
    } else if (format === "html") {
      if (!svg) throw new Error("No SVG to export");
      const blob = await exportService.exportHTML(svg, spec.value);
      await downloadBlob(blob, `${baseName}.html`);
    } else if (format === "spec-json") {
      const blob = await exportService.exportSpec(spec.value);
      await downloadBlob(blob, `${baseName}.json`);
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(err instanceof Error ? err.message : String(err));
  }
}
</script>

<template>
  <main class="page">
    <header class="page__header">
      <div>
        <p class="eyebrow">Chart Builder</p>
        <h1>Specification-driven charts</h1>
        <p class="muted">Choose type of Graph, configure, preview and export.</p>
      </div>
      <div class="page__actions">
        <div class="pill-group">
          <button
            v-for="format in exportFormats"
            :key="format"
            class="pill"
            type="button"
            :aria-label="`Export ${format.toUpperCase()}`"
            @click="handleExport(format)">
            {{ format.toUpperCase() }}
          </button>
        </div>
        <div class="badge" :class="{ 'badge--ok': isValid, 'badge--error': !isValid }">
          {{ isValid ? "Spec valid" : "Spec invalid" }}
        </div>
      </div>
    </header>

    <section class="layout">
      <div class="layout__side">
        <ChartTypeSelector :selected="spec.type" @select="updateType" @preset="applyPreset" />

        <section class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="panelOpen.options = !panelOpen.options">
            <span>Configure options</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.options }">›</span>
          </button>
          <div v-if="panelOpen.options" class="panel__body">
            <ChartOptionsPanel :layout="spec.layout" :style="spec.style" @update:layout="updateLayout" @update:style="updateStyle" />
          </div>
        </section>

        <section v-if="spec.type === 'bar'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="panelOpen.builder = !panelOpen.builder">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <BarBuilderControls :config="barConfig" :fields="dataFields" @update:config="updateBarConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'line'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="panelOpen.builder = !panelOpen.builder">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <LineBuilderControls :config="lineConfig" @update:config="updateLineConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'area'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="panelOpen.builder = !panelOpen.builder">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <AreaBuilderControls :config="areaConfig" @update:config="updateAreaConfig" />
          </div>
        </section>

        <section class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="panelOpen.data = !panelOpen.data">
            <span>Bind data source</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.data }">›</span>
          </button>
          <div v-if="panelOpen.data" class="panel__body">
            <DataBindingPanel
              :binding="spec.data"
              @update:binding="updateBinding"
              @update:encoding="updateEncoding"
              @update:years="updateYears"
              @navigate:config="() => { panelOpen.options = true; panelOpen.builder = true; }"
              @preview-refresh="onPreviewRefresh"
            />
          </div>
        </section>

      </div>
      <div class="layout__main">
        <PreviewPane
          ref="previewRef"
          :spec="spec"
          :selected-years="selectedYears"
          :bar-config="barConfig"
          :line-config="lineConfig"
          :area-config="areaConfig"
          :last-validated="lastValidated"
          @update:fields="updateFields"
          @update:encoding="updateEncoding"
          @refresh="refreshPreview"
        />
        <div v-if="validationError" class="alert">{{ validationError }}</div>
      </div>
    </section>
  </main>
</template>
