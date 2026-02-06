<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from "vue";
import { chartSpecSchema, type ChartSpec } from "./specs/chartSpec";
import ChartTypeSelector from "./components/ChartTypeSelector.vue";
import ChartOptionsPanel from "./components/ChartOptionsPanel.vue";
import BarBuilderControls from "./components/BarBuilderControls.vue";
import LineBuilderControls from "./components/LineBuilderControls.vue";
import AreaBuilderControls from "./components/AreaBuilderControls.vue";
import PieBuilderControls from "./components/PieBuilderControls.vue";
import MapBuilderControls from "./components/MapBuilderControls.vue";
import DataBindingPanel from "./components/DataBindingPanel.vue";
import PreviewPane from "./components/PreviewPane.vue";
import { exportService, type ExportFormat } from "./export/exportService";
import { computed as vueComputed } from "vue";
import type { LineChartConfig } from "./charts/line";
import type { AreaChartConfig } from "./charts/areaV7";
import type { PieConfig } from "./charts/pie";
import type { MapConfig } from "./charts/map";

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

const pieConfig = ref<PieConfig>({
  innerRadius: 0,
  outerRadiusOffset: 15,
  animationDuration: 800,
  showLabels: true,
  showTooltip: true,
});

const mapConfig = ref<MapConfig>({
  colorMode: 'gradient',
  colorScheme: 'interpolateBlues',
  scale: 400,
  projectionCenter: [20, 5],
  animationDuration: 1000,
  showTooltip: true,
  backgroundColor: '#ffffff',
  noDataColor: '#eee',
  thresholds: [20, 40, 60, 80],
  useCustomGradient: false,
  gradientLowColor: '#e0f2fe',
  gradientHighColor: '#0369a1',
});

const lineConfig = ref<LineChartConfig>({
  xKey: '',
  yKey: '',
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
  xKey: '',
  yKey: '',
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
// Removed unused 'isValid' variable from here if it's not used in template

const panelOpen = ref({
  type: false,
  options: false,
  builder: false,
  data: false,
});

const exportFormats: ExportFormat[] = ["svg", "png", "pdf", "html", "spec-json", "project-json"];
const projectInputRef = ref<HTMLInputElement | null>(null);

const shareOpen = ref(false);
const shareButtonRef = ref<HTMLElement | null>(null);
const shareDropdownRef = ref<HTMLElement | null>(null);

const downloadOpen = ref(false);
const downloadButtonRef = ref<HTMLElement | null>(null);
const downloadDropdownRef = ref<HTMLElement | null>(null);

function toggleShare() {
  shareOpen.value = !shareOpen.value;
}

function selectShare(format: ExportFormat) {
  shareOpen.value = false;
  handleExport(format);
}

function toggleDownload() {
  downloadOpen.value = !downloadOpen.value;
}

function selectDownload(format: ExportFormat) {
  downloadOpen.value = false;
  handleExport(format);
}

function handleDocClick(e: MouseEvent) {
  // Only proceed if at least one dropdown is open
  if (!shareOpen.value && !downloadOpen.value) return;
  const path = (e.composedPath && e.composedPath()) || (e as any).path || [];
  const sBtn = shareButtonRef.value;
  const sDd = shareDropdownRef.value;
  const dBtn = downloadButtonRef.value;
  const dDd = downloadDropdownRef.value;
  // If click happened inside either the share button/dropdown or download button/dropdown, ignore
  if (sBtn && sDd && (path.includes(sBtn) || path.includes(sDd))) return;
  if (dBtn && dDd && (path.includes(dBtn) || path.includes(dDd))) return;
  // Otherwise close both
  shareOpen.value = false;
  downloadOpen.value = false;
}

onMounted(() => document.addEventListener('click', handleDocClick, true));
onBeforeUnmount(() => document.removeEventListener('click', handleDocClick, true));

// chevron helper removed
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
  // When switching to certain chart types, suggest sensible default layout presets.
  if (type === 'orbitDonut') {
    spec.value = { ...spec.value, type, layout: { ...spec.value.layout, preset: 'grid' } };
  } else if (type === 'dotDonut') {
    spec.value = { ...spec.value, type, layout: { ...spec.value.layout, preset: 'grid' } };
  } else {
    spec.value = { ...spec.value, type };
  }
  refreshPreview();
}

function applyPreset(payload: { type: ChartSpec["type"]; layoutPreset?: "single" | "horizontal" | "vertical" | "grid" | "smallMultiples"; mode?: "grouped" | "stacked" | "percent" | "simple" }) {
  const nextStyle = { ...spec.value.style } as any;
  if (payload.mode) nextStyle.mode = payload.mode;
  const currentLayout = spec.value.layout || { preset: "single" };
  const nextLayout = { ...currentLayout, preset: payload.layoutPreset ?? currentLayout.preset };
  spec.value = { ...spec.value, type: payload.type, style: nextStyle, layout: nextLayout } as ChartSpec;
  refreshPreview();
}

function updateLayout(payload: Partial<ChartSpec["layout"]>) {
  const currentLayout = spec.value.layout || { preset: "single" };
  const preset = payload?.preset ?? currentLayout.preset;
  spec.value = { ...spec.value, layout: { ...currentLayout, ...payload, preset } };
}

function updateTitle(title: string) {
  spec.value = { ...spec.value, title };
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

function updatePieConfig(next: PieConfig) {
  pieConfig.value = next;
}

function updateMapConfig(next: MapConfig) {
  mapConfig.value = next;
}

function refreshPreview() {
  nextTick(() => {
    previewRef.value?.reload?.();
  });
}

function onPreviewRefresh() {
  nextTick(() => {
    previewRef.value?.reload?.();
  });
}

function togglePanel(key: 'type' | 'options' | 'builder' | 'data') {
  const wasOpen = (panelOpen.value as any)[key];
  // close all panels first
  Object.keys(panelOpen.value).forEach(k => { (panelOpen.value as any)[k] = false; });
  // toggle the requested panel
  (panelOpen.value as any)[key] = !wasOpen;
}

const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null);

async function togglePreviewFullscreen() {
  try {
    const comp = previewRef.value as any;
    const el = comp?.$el ?? document.querySelector('.panel.preview');
    if (!el) throw new Error('Preview element not found');
    if (!document.fullscreenElement || document.fullscreenElement !== el) {
      if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) await (el as any).webkitRequestFullscreen();
    } else {
      if (document.exitFullscreen) await document.exitFullscreen();
      else if ((document as any).webkitExitFullscreen) await (document as any).webkitExitFullscreen();
    }
  } catch (err) {
    console.warn('Fullscreen preview failed', err);
  }
}

const embedOpen = ref(false);
const embedSnippet = ref<string | null>(null);

function openEmbed() {
  const id = spec.value.id ?? 'REPLACE_ID';
  embedSnippet.value = `<iframe src="https://ecastats.uneca.org/data/headless/visualizations/${encodeURIComponent(id)}" width="100%" height="100%" frameborder="0"></iframe>`;
  embedOpen.value = true;
}

async function copyEmbed() {
  if (!embedSnippet.value) return;
  try {
    await navigator.clipboard.writeText(embedSnippet.value);
    alert('Embed snippet copied to clipboard');
  } catch (err) {
    console.error('Copy failed', err);
    alert('Copy failed — see console');
  }
}

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
      await downloadBlob(blob, `${baseName}-spec.json`);
    } else if (format === "project-json") {
      const data = previewRef.value?.rows || [];
      const blob = await exportService.exportProject(spec.value, data);
      await downloadBlob(blob, `${baseName}-project.json`);
    }
  } catch (err) {
    console.error("Export failed:", err);
    alert(err instanceof Error ? err.message : String(err));
  }
}

async function handleLoadProject(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const project = JSON.parse(text);

    if (project.version !== "1.0" || !project.spec) {
      throw new Error("Invalid project file format");
    }

    // Restore spec
    spec.value = project.spec;

    // If data is embedded, create a new blob URL and update the source
    if (project.data && project.data.length > 0) {
      const textJson = JSON.stringify(project.data);
      const blobUrl = URL.createObjectURL(new Blob([textJson], { type: "application/json" }));
      spec.value.data.query.source = blobUrl;
    }

    refreshPreview();
    alert("Project loaded successfully");
  } catch (err) {
    console.error("Load failed:", err);
    alert("Failed to load project: " + (err instanceof Error ? err.message : String(err)));
  } finally {
    if (input) input.value = '';
  }
}

function triggerLoadProject() {
  projectInputRef.value?.click();
}
</script>

<template>
  <main class="page">
    <header class="page__header">
      <div>
        <p class="eyebrow">Chart Builder</p>
        <h1>ECAStats Chart Builder</h1>
        <p class="muted">Choose type of Graph, configure, preview and export.</p>
      </div>
      <div class="page__actions" style="display:flex;gap:8px;align-items:center">
        <input type="file" ref="projectInputRef" style="display:none" accept="application/json" @change="handleLoadProject" />
        <button class="btn btn--outline" @click="triggerLoadProject">
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:4px"><path d="M4 12v7a2 2 0 002 2h12a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M16 6l-4-4-4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
          Load Project
        </button>

        <div style="position:relative">
          <button ref="downloadButtonRef" class="icon-btn" aria-haspopup="true" :aria-expanded="downloadOpen" @click="toggleDownload" title="Export">
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 21H3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div v-if="downloadOpen" ref="downloadDropdownRef" class="dropdown">
            <button v-for="format in exportFormats" :key="format" class="dropdown-item" @click="selectDownload(format)">
              <span class="item-icon"> 
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 3v12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 11l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <span class="item-label">{{ format === 'project-json' ? 'SAVE PROJECT' : format.toUpperCase() }}</span>
            </button>
          </div>
        </div>

        <div style="position:relative">
          <button ref="shareButtonRef" class="icon-btn" aria-haspopup="true" :aria-expanded="shareOpen" @click="toggleShare" title="Share">
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l-4-4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 2v11" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
          </button>
          <div v-if="shareOpen" ref="shareDropdownRef" class="dropdown">
            <button class="dropdown-item" @click="openEmbed">
              <span class="item-icon"> 
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 17v2a1 1 0 001 1h6a1 1 0 001-1v-2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 7V5a1 1 0 011-1h6a1 1 0 011 1v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 11v2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <span class="item-label">Embed this chart</span>
            </button>
            <button class="dropdown-item">
              <span class="item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 12v7a1 1 0 001 1h14a1 1 0 001-1v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 6l-4-4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <span class="item-label">Share via…</span>
            </button>
            <button class="dropdown-item" @click="selectShare('png')">
              <span class="item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="3" width="18" height="14" rx="2" stroke="currentColor" stroke-width="1.5"/><path d="M8 21h8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
              </span>
              <span class="item-label">Copy chart as image</span>
            </button>
            <button class="dropdown-item">
              <span class="item-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 14l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 12v7a1 1 0 01-1 1H4a1 1 0 01-1-1v-7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </span>
              <span class="item-label">Copy link to chart</span>
            </button>
          </div>
        </div>

        <div>
          <button class="icon-btn" title="Fullscreen preview" @click="togglePreviewFullscreen">
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M20 20h-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M20 20v-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <section class="layout">
      <div class="layout__side">
        <section class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('data')">
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

        <section class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('type')">
            <span>Select chart type</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.type }">›</span>
          </button>
          <div v-if="panelOpen.type" class="panel__body">
            <ChartTypeSelector :selected="spec.type" @select="updateType" @preset="applyPreset" />
          </div>
        </section>

        <section class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('options')">
            <span>Configure options</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.options }">›</span>
          </button>
          <div v-if="panelOpen.options" class="panel__body">
            <ChartOptionsPanel 
              :layout="spec.layout" 
              :style="spec.style" 
              :title="spec.title"
              @update:layout="updateLayout" 
              @update:style="updateStyle" 
              @update:title="updateTitle"
            />
          </div>
        </section>

        <section v-if="spec.type === 'bar'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('builder')">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <BarBuilderControls :config="barConfig" :fields="dataFields" @update:config="updateBarConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'line'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('builder')">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <LineBuilderControls :config="lineConfig" @update:config="updateLineConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'area'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('builder')">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <AreaBuilderControls :config="areaConfig" @update:config="updateAreaConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'pie'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('builder')">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <PieBuilderControls :config="pieConfig" @update:config="updatePieConfig" />
          </div>
        </section>

        <section v-if="spec.type === 'map'" class="panel panel--foldable">
          <button class="panel__toggle" type="button" @click="togglePanel('builder')">
            <span>Builder controls</span>
            <span class="chevron" :class="{ 'chevron--open': panelOpen.builder }">›</span>
          </button>
          <div v-if="panelOpen.builder" class="panel__body">
            <MapBuilderControls :config="mapConfig" @update:config="updateMapConfig" />
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
          :pie-config="pieConfig"
          :map-config="mapConfig"
          :last-validated="lastValidated"
          @update:fields="updateFields"
          @update:encoding="updateEncoding"
          @refresh="refreshPreview"
        />
        <div v-if="validationError" class="alert">{{ validationError }}</div>
      </div>
    </section>
    <div v-if="embedOpen">
      <div style="position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);background:white;border:1px solid #e2e8f0;padding:12px;z-index:1000;max-width:90%;width:720px;">
        <h3 class="panel__title">Embed Chart</h3>
        <p class="muted">Copy and paste this code to embed the chart:</p>
        <textarea readonly style="width:100%;height:120px;font-family:monospace;white-space:pre-wrap;overflow:auto;" :value="embedSnippet"></textarea>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:8px;">
          <button class="pill" @click="copyEmbed">Copy</button>
          <button class="pill" @click="embedOpen = false">Close</button>
        </div>
      </div>
      <div class="embed-backdrop" @click="embedOpen = false" style="position:fixed;inset:0;background:rgba(0,0,0,0.3);z-index:900;"></div>
    </div>
  </main>
</template>

<style scoped>
.icon-btn {
  background: #ffffff;
  border: 1px solid #e6eef8;
  padding: 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.icon-btn:hover { background:#f8fbff }
.icon { color: #374151 }
.panel.preview:fullscreen, .panel.preview:-webkit-full-screen {
  position: fixed;
  inset: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  padding: 12px;
  background: white;
}
.panel.preview:fullscreen .preview__frame, .panel.preview:-webkit-full-screen .preview__frame {
  height: calc(100% - 72px);
}
.dropdown { position:absolute; right:0; margin-top:8px; background:white; border:1px solid #e2e8f0; border-radius:6px; box-shadow:0 8px 24px rgba(2,6,23,0.12); z-index:40; padding:8px; }
.dropdown-item { display:flex; gap:10px; align-items:center; width:240px; padding:8px; border-radius:6px; background:transparent; border:0; text-align:left; cursor:pointer }
.dropdown-item:hover { background:#f8fafc }
.item-icon { width:28px; display:inline-flex; align-items:center; justify-content:center; color:#6b7280 }
.item-label { flex:1; color:#111827 }
</style>
