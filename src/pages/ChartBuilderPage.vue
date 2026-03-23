<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onBeforeUnmount, computed } from "vue";
import { useRoute, useRouter, onBeforeRouteLeave } from "vue-router";
import { chartSpecSchema, type ChartSpec } from "../specs/chartSpec";
import ChartTypeSelector from "../components/ChartTypeSelector.vue";
import ChartOptionsPanel from "../components/ChartOptionsPanel.vue";
import BarBuilderControls from "../components/BarBuilderControls.vue";
import PieBuilderControls from "../components/PieBuilderControls.vue";
import MapBuilderControls from "../components/MapBuilderControls.vue";
import DatasetUploadPanel from "../components/DatasetUploadPanel.vue";
import ManualDatasetEditor from "../components/ManualDatasetEditor.vue";
import ScatterBuilderControls, { type ScatterBuilderConfig } from "../components/ScatterBuilderControls.vue";
import BubbleBuilderControls from "../components/BubbleBuilderControls.vue";
import DotDonutBuilderControls from "../components/DotDonutBuilderControls.vue";
import OrbitDonutBuilderControls from "../components/OrbitDonutBuilderControls.vue";
import StackedBarBuilderControls from "../components/StackedBarBuilderControls.vue";
import PreviewPane from "../components/PreviewPane.vue";
import { exportService, type ExportFormat } from "../export/exportService";
import { useProjectStore } from "../stores/projectStore";
import { useResponsiveStore } from "../stores/responsiveStore";
import chartService from "../services/chartService";
import type { ChartRecord } from "../services/chartService";
import projectService, { type ProjectRecord } from "../services/projectService";
import datasetService, { type DatasetRecord } from "../services/datasetService";
import { useChartBuilderStore } from "../stores/chartBuilderStore";
import type { LineChartConfig } from "../charts/line";
import type { AreaChartConfig } from "../charts/areaV7";
import type { PieConfig } from "../charts/pie";
import type { MapConfig } from "../charts/map";
import type { BubbleChartConfig } from "../charts/bubble";
import type { DotDonutConfig } from "../charts/dotDonut";
import type { OrbitDonutConfig } from "../charts/orbitDonut";
import type { StackedBarConfig } from "../charts/stackedBar";
import type { BarBuilderConfig } from "../components/BarBuilderControls.vue";
import { validateConfigForType, getDefaultsForType } from "../config/configManager";
import LineChartConfigPanel from "../components/config/LineChartConfigPanel.vue";
import AreaChartConfigPanel from "../components/config/AreaChartConfigPanel.vue";
import StackedAreaConfigPanel from "../components/config/StackedAreaConfigPanel.vue";

const spec = ref<ChartSpec>({
  version: "1.0",
  id: "draft-1",
  type: "bar",
  title: "Draft chart",
  data: {
    provider: "json",
    kind: "json",
    query: { source: "" },
    syncMode: "live",
  },
  encoding: {
    category: { field: "category" },
    value: { field: "value", aggregate: "sum" },
    series: { field: "series" },
  },
  layout: { preset: "single", width: 720, height: 420 },
  style: { palette: ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd"], numberFormat: 'default' },
});

const lastValidated = ref<string | undefined>();
const validationError = ref<string | undefined>();
const activeStep = ref(1);
const selectedChartType = ref<ChartSpec["type"] | null>(null);

const steps = [
  { id: 1, label: "Data", icon: "database" },
  { id: 2, label: "Type", icon: "bar-chart" },
  { id: 3, label: "Config", icon: "settings" },
  { id: 4, label: "Style", icon: "palette" },
];

const barConfig = ref<BarBuilderConfig>({
  cornerRadius: 4,
  barPadding: 0.2,
  barColor: "#4F81BD",
  animationDuration: 800,
  staggerDelay: 30,
  showGridlines: true,
  showValues: true,
  showXAxisLabels: true,
  showYAxisLabels: true,
  xLabelOffset: 0,
  xLabelRotation: 0,
  yLabelOffset: 0,
  labelAlignment: 'left',
  separateLabelLine: false,
  numberFormat: 'default',
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
  labelPosition: 'top',
  labelRotate: 0,
  labelDistance: 5,
  labelFontSize: 12,
  labelFontWeight: 'normal',
  labelFontColor: '#333333',
  overlays: [],
  labelOffset: 6,
  labelPositionMode: 'auto',
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
  showLabels: true,
  labelFontSize: 10,
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

const lineConfig = ref<any>(getDefaultsForType('line'));

const areaConfig = ref<any>(getDefaultsForType('area'));
const stackedAreaConfig = ref<any>(getDefaultsForType('stackedArea'));

const scatterConfig = ref<ScatterBuilderConfig>({
  animationDuration: 1000,
  pointRadius: 6,
  showGridlines: true,
  showLegend: true,
  showTooltip: true,
});

const bubbleConfig = ref<BubbleChartConfig>({
  textColor: '#0b1220',
  topColor: '#2E7A7A',
  bottomColor: '#F2C57C',
  middleColor: '#D1D5DB',
});

const dotDonutConfig = ref<DotDonutConfig>({
  dotsCount: 36,
  activeColor: '#2563eb',
  inactiveColor: '#cbd5e1',
  textColor: '#0f172a',
});

const orbitDonutConfig = ref<OrbitDonutConfig>({
  layout: 'horizontal',
  centerColor: '#2563eb',
  textColor: '#111',
  labelColor: '#555',
});

const stackedBarConfig = ref<StackedBarConfig>({
  animationDuration: 1000,
  showTooltip: true,
  showLegend: true,
  barPadding: 0.2,
  cornerRadius: 4,
});

const projectStore = useProjectStore();
const chartBuilderStore = useChartBuilderStore();
const responsiveStore = useResponsiveStore();
const route = useRoute();
const router = useRouter();
const showSidebar = ref(true);
const availableProjects = ref<ProjectRecord[]>([]);
const availableDatasets = ref<DatasetRecord[]>([]);
const selectedDatasetId = ref<string>("");
const isLoadingDatasets = ref(false);
const selectedDatasetName = ref<string>("");
const showDatasetUploadPanel = ref(false);
const showManualDatasetEditor = ref(false);
const newProjectName = ref("");
const isSavingChart = ref(false);
const saveSuccessMessage = ref<string | null>(null);
const saveErrorMessage = ref<string | null>(null);
const datasetBlobUrl = ref<string | null>(null);
const currentProjectId = computed(() => projectStore.currentProject?.id ?? "");
const savedCharts = ref<ChartRecord[]>([]);
const currentChartId = ref<string>("");
const isDirty = ref(false);
const isRestoringChart = ref(false);
const isPersistingChart = ref(false);
const hasInitializedDraft = ref(false);
const lastSavedFingerprint = ref<string>("");
const GLOBAL_SELECTED_DATASET_KEY = "selectedDatasetId";
const DATASET_SYNC_SIGNAL_KEY = "chartBuilder:lastDatasetUpdate";
const LAST_SAVED_CHART_KEY_PREFIX = "chartBuilder:lastSavedChart:";
const CHART_SYNC_SIGNAL_KEY = "chartBuilder:lastChartPersist";
const MAX_FILTERED_SNAPSHOT_ROWS = 2000;
const MAX_INLINE_SOURCE_ROWS = 2000;
const routeAutoLoadApplied = ref(false);
const incomingDatasetLoading = ref(false);

type SavedChartState = {
  id: string;
  projectId: string;
  name: string;
  datasetId: string;
  filteredData: Record<string, unknown>[];
  previewImageDataUrl?: string;
  config: {
    chartType: string;
    xAxis: string;
    yAxis: string;
    groupBy?: string;
    aggregation?: string;
  };
  style: {
    colors: string[];
    fontSize: number;
    fontFamily?: string;
    legendPosition: string;
    grid: boolean;
    background: string;
    layout?: ChartSpec["layout"];
  };
  animation: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
  filters: {
    appliedFilters: Array<{ column: string; values: string[] }>;
  };
  createdAt: string;
  updatedAt: string;
  snapshotMeta?: {
    totalFilteredRows: number;
    storedFilteredRows: number;
    truncated: boolean;
  };
};

function queryValue(input: unknown): string {
  if (Array.isArray(input)) {
    return typeof input[0] === 'string' ? input[0] : '';
  }

  return typeof input === 'string' ? input : '';
}

function getPendingRestoreChartId(projectId?: string): string {
  const routeChartId = queryValue(route.query.chartId);
  if (routeChartId) {
    return routeChartId;
  }

  const draftChartId = chartBuilderStore.draft?.chartId ?? "";
  const draftProjectId = chartBuilderStore.draft?.projectId ?? "";
  if (draftChartId && (!projectId || !draftProjectId || draftProjectId === projectId)) {
    return draftChartId;
  }

  return "";
}

function toStableJson(value: unknown): string {
  try {
    return JSON.stringify(value, (_key, nestedValue) => {
      if (nestedValue && typeof nestedValue === "object" && !Array.isArray(nestedValue)) {
        const sortedEntries = Object.entries(nestedValue as Record<string, unknown>)
          .sort(([left], [right]) => left.localeCompare(right));
        return Object.fromEntries(sortedEntries);
      }
      return nestedValue;
    });
  } catch {
    return "";
  }
}

function toBase64Utf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function buildInlineJsonDataUrl(rows: Record<string, unknown>[]): string {
  const json = JSON.stringify(rows);
  return `data:application/json;charset=utf-8,${encodeURIComponent(json)}`;
}

function sanitizeSpecForSave(
  inputSpec: ChartSpec,
  fallbackRows: Record<string, unknown>[],
): ChartSpec {
  const cloned = JSON.parse(JSON.stringify(inputSpec)) as ChartSpec;
  const source = cloned?.data?.query?.source;

  if (typeof source === "string" && source.startsWith("blob:")) {
    const safeRows = fallbackRows.length > 0 ? fallbackRows : [];
    cloned.data = {
      ...cloned.data,
      provider: "json",
      kind: "json",
      query: {
        ...cloned.data.query,
        source: buildInlineJsonDataUrl(safeRows),
      },
    };
  }

  return cloned;
}

function capturePreviewImageDataUrl(): string | undefined {
  try {
    const svg = previewRef.value?.getSvgEl?.();
    if (!svg) {
      return undefined;
    }

    const serialized = new XMLSerializer().serializeToString(svg);
    return `data:image/svg+xml;base64,${toBase64Utf8(serialized)}`;
  } catch (error) {
    console.warn("Preview image capture failed:", error);
    return undefined;
  }
}

function getLastSavedChartStorageKey(projectId: string): string {
  return `${LAST_SAVED_CHART_KEY_PREFIX}${projectId}`;
}

function rememberLastSavedChart(projectId: string, chartId: string): void {
  if (!projectId || !chartId) {
    return;
  }

  localStorage.setItem(getLastSavedChartStorageKey(projectId), chartId);
}

function readLastSavedChart(projectId: string): string {
  if (!projectId) {
    return "";
  }

  return localStorage.getItem(getLastSavedChartStorageKey(projectId)) ?? "";
}

function forgetLastSavedChart(projectId: string, chartId?: string): void {
  if (!projectId) {
    return;
  }

  const storageKey = getLastSavedChartStorageKey(projectId);
  if (!chartId) {
    localStorage.removeItem(storageKey);
    return;
  }

  const remembered = localStorage.getItem(storageKey);
  if (remembered === chartId) {
    localStorage.removeItem(storageKey);
  }
}

function clearPersistedChartReference(chartId: string, projectId?: string): void {
  if (!chartId) {
    return;
  }

  if (currentChartId.value === chartId) {
    currentChartId.value = "";
  }

  if (spec.value.id === chartId) {
    spec.value = {
      ...spec.value,
      id: "",
    };
  }

  if (projectId) {
    forgetLastSavedChart(projectId, chartId);
  }

  if (chartBuilderStore.draft?.chartId === chartId) {
    chartBuilderStore.setDraftChartId(null);
  }
}

function isSupportedChartType(type: string): type is ChartSpec['type'] {
  return [
    'bar',
    'line',
    'area',
    'stackedArea',
    'stackedBar',
    'pie',
    'scatter',
    'bubble',
    'map',
    'dotDonut',
    'orbitDonut',
  ].includes(type);
}

async function applyIncomingDatasetFromRoute(): Promise<void> {
  if (routeAutoLoadApplied.value) {
    return;
  }

  const datasetId = queryValue(route.query.datasetId);
  if (!datasetId) {
    routeAutoLoadApplied.value = true;
    return;
  }

  incomingDatasetLoading.value = true;
  saveErrorMessage.value = null;
  saveSuccessMessage.value = "Loading dataset into chart builder...";

  try {
    const incomingProjectId = queryValue(route.query.projectId);
    if (incomingProjectId && incomingProjectId !== currentProjectId.value) {
      const targetProject = availableProjects.value.find((project) => project.id === incomingProjectId);
      if (targetProject) {
        projectStore.setCurrentProject({ id: targetProject.id, name: targetProject.name });
        await loadDatasetsForProject(targetProject.id);
      }
    }

    await selectDatasetById(datasetId);

    const incomingType = queryValue(route.query.chartType);
    if (incomingType && isSupportedChartType(incomingType)) {
      updateType(incomingType);
    }

    const xField = queryValue(route.query.xField);
    const yField = queryValue(route.query.yField);
    const seriesField = queryValue(route.query.seriesField);

    if (xField && yField) {
      updateEncoding({
        category: xField,
        value: yField,
        series: seriesField || undefined,
      });
    }

    activeStep.value = 3;
    saveSuccessMessage.value = "Dataset saved and loaded into chart builder.";
  } catch (error) {
    saveSuccessMessage.value = null;
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to load incoming dataset.");
  } finally {
    incomingDatasetLoading.value = false;
    routeAutoLoadApplied.value = true;

    const shouldCleanQuery = !!queryValue(route.query.datasetId);
    if (shouldCleanQuery) {
      const cleanedQuery = { ...route.query } as Record<string, unknown>;
      delete cleanedQuery.datasetId;
      delete cleanedQuery.projectId;
      delete cleanedQuery.autoload;
      delete cleanedQuery.chartType;
      delete cleanedQuery.xField;
      delete cleanedQuery.yField;
      delete cleanedQuery.seriesField;

      router.replace({ query: cleanedQuery });
    }
  }
}

async function applyIncomingChartFromRoute(): Promise<void> {
  const chartId = queryValue(route.query.chartId);
  if (!chartId) {
    return;
  }

  const incomingProjectId = queryValue(route.query.projectId);
  if (incomingProjectId && incomingProjectId !== currentProjectId.value) {
    const targetProject = availableProjects.value.find((project) => project.id === incomingProjectId);
    if (targetProject) {
      projectStore.setCurrentProject({ id: targetProject.id, name: targetProject.name });
      await loadDatasetsForProject(targetProject.id, { skipAutoSelect: true });
      await loadSavedCharts(targetProject.id);
    }
  }

  if (currentChartId.value === chartId) {
    return;
  }

  await restoreChartById(chartId);

  const cleanedQuery = { ...route.query } as Record<string, unknown>;
  delete cleanedQuery.chartId;
  await router.replace({ query: cleanedQuery });
}

async function restoreDraftFromStore(): Promise<void> {
  if (hasInitializedDraft.value) {
    return;
  }

  const draft = chartBuilderStore.draft;
  if (!draft || !draft.spec || !draft.projectId) {
    hasInitializedDraft.value = true;
    return;
  }

  const targetProject = availableProjects.value.find((project) => project.id === draft.projectId);
  if (targetProject) {
    projectStore.setCurrentProject({ id: targetProject.id, name: targetProject.name });
    await loadDatasetsForProject(targetProject.id, { skipAutoSelect: true });
    await loadSavedCharts(targetProject.id);
  }

  const draftChartId = draft.chartId ?? "";
  const hasSavedChart = draftChartId
    ? savedCharts.value.some((chart) => chart.id === draftChartId)
    : false;

  if (draftChartId && hasSavedChart) {
    await restoreChartById(draftChartId);
    hasInitializedDraft.value = true;
    return;
  }

  isRestoringChart.value = true;
  try {
    spec.value = sanitizeSpecForSave(draft.spec as ChartSpec, []);

    const configs = draft.chartConfigs;
    if (configs && typeof configs === "object") {
      applyChartConfig(configs);
    }

    if (draftChartId && !hasSavedChart) {
      clearPersistedChartReference(draftChartId, draft.projectId);
    } else {
      currentChartId.value = draftChartId;
    }

    if (draft.datasetId) {
      await selectDatasetById(draft.datasetId);
    }

    refreshPreview();
    lastSavedFingerprint.value = toStableJson({
      projectId: currentProjectId.value,
      datasetId: selectedDatasetId.value,
      chartId: currentChartId.value,
      spec: spec.value,
      chartConfigs: configs ?? {},
    });
    isDirty.value = false;
  } finally {
    isRestoringChart.value = false;
    hasInitializedDraft.value = true;
  }
}

function getDatasetStorageKey(projectId: string): string {
  return `chartBuilder:selectedDataset:${projectId}`;
}

function persistSelectedDataset(projectId: string, datasetId: string): void {
  if (!projectId || !datasetId) {
    return;
  }

  localStorage.setItem(getDatasetStorageKey(projectId), datasetId);
}

function clearPersistedDataset(projectId: string): void {
  if (!projectId) {
    return;
  }

  localStorage.removeItem(getDatasetStorageKey(projectId));
}

function getPersistedDataset(projectId: string): string {
  if (!projectId) {
    return "";
  }

  return localStorage.getItem(getDatasetStorageKey(projectId)) ?? "";
}

function getGlobalSelectedDataset(): string {
  return localStorage.getItem(GLOBAL_SELECTED_DATASET_KEY) ?? "";
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }

  const maybeAxios = error as {
    message?: string;
    response?: {
      data?: {
        message?: string;
        error?: string;
        title?: string;
        details?: string[];
        errors?: Record<string, string[]>;
      } | string;
    };
  };

  const responseData = maybeAxios.response?.data;
  if (typeof responseData === "string" && responseData.trim().length > 0) {
    return responseData;
  }

  if (typeof responseData === "object" && responseData !== null) {
    if (responseData.errors && typeof responseData.errors === "object") {
      const firstFieldError = Object.values(responseData.errors)
        .find((messages) => Array.isArray(messages) && messages.length > 0)
        ?.[0];

      if (typeof firstFieldError === "string" && firstFieldError.trim().length > 0) {
        return firstFieldError;
      }
    }

    if (Array.isArray(responseData.details) && responseData.details.length > 0) {
      const firstDetail = responseData.details.find((value) => typeof value === "string" && value.trim().length > 0);
      if (firstDetail) {
        return firstDetail;
      }
    }

    const apiMessage = responseData.message ?? responseData.error ?? responseData.title;
    if (typeof apiMessage === "string" && apiMessage.trim().length > 0) {
      return apiMessage;
    }
  }

  if (typeof maybeAxios.message === "string" && maybeAxios.message.trim().length > 0) {
    return maybeAxios.message;
  }

  return fallback;
}

function getApiErrorStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const maybeAxios = error as {
    response?: {
      status?: number;
    };
  };

  return typeof maybeAxios.response?.status === "number"
    ? maybeAxios.response.status
    : undefined;
}

function isMissingChartError(error: unknown): boolean {
  return getApiErrorStatus(error) === 404
    && getApiErrorMessage(error, "").toLowerCase().includes("chart not found");
}

function broadcastChartPersistence(projectId: string, chartId: string, action: "saved" | "deleted"): void {
  if (!projectId) {
    return;
  }

  const payload = {
    projectId,
    chartId,
    action,
    timestamp: Date.now(),
  };

  localStorage.setItem(CHART_SYNC_SIGNAL_KEY, JSON.stringify(payload));
  window.dispatchEvent(new CustomEvent("chartBuilder:charts-updated", { detail: payload }));
}

async function applySavedFilters(filters?: Array<{ column: string; values: string[] }>): Promise<void> {
  const normalizedFilters = Array.isArray(filters)
    ? filters
        .filter((filter) => filter && typeof filter.column === "string")
        .map((filter) => ({
          column: filter.column,
          values: Array.isArray(filter.values) ? filter.values.map((value) => String(value)) : [],
        }))
    : [];

  await nextTick();
  const preview = previewRef.value as {
    setValueFilters?: (nextFilters: Array<{ column: string; values: string[] }>) => void;
  } | null;
  preview?.setValueFilters?.(normalizedFilters);
}

function getChartConfigPayload(datasetId: string, previewImageDataUrl?: string) {
  const previewRows = getPreviewRows();
  const previewFilteredRows = getPreviewFilteredRows();
  const activeFilters = sidebarActiveFilters.value.map((filter) => ({
    column: filter.column,
    values: [...filter.values],
  }));
  const filteredSnapshot = previewFilteredRows.slice(0, MAX_FILTERED_SNAPSHOT_ROWS);
  const persistedRows = previewRows.length > 0 ? previewRows : filteredSnapshot;
  const sanitizedSpec = sanitizeSpecForSave(spec.value, persistedRows);

  const primaryAnimationDuration = [
    (barConfig.value as { animationDuration?: number }).animationDuration,
    (lineConfig.value as { animationDuration?: number }).animationDuration,
    (areaConfig.value as { animationDuration?: number }).animationDuration,
    (scatterConfig.value as { animationDuration?: number }).animationDuration,
    (pieConfig.value as { animationDuration?: number }).animationDuration,
    (mapConfig.value as { animationDuration?: number }).animationDuration,
    (stackedBarConfig.value as { animationDuration?: number }).animationDuration,
  ].find((value) => typeof value === "number" && value >= 0) ?? 0;

  const chartState: SavedChartState = {
    id: currentChartId.value || spec.value.id || crypto.randomUUID(),
    projectId: currentProjectId.value,
    name: spec.value.title?.trim() || "Untitled Chart",
    datasetId,
    filteredData: filteredSnapshot,
    ...(previewImageDataUrl ? { previewImageDataUrl } : {}),
    config: {
      chartType: sanitizedSpec.type,
      xAxis: sanitizedSpec.encoding.category.field,
      yAxis: sanitizedSpec.encoding.value.field,
      groupBy: sanitizedSpec.encoding.series?.field,
      aggregation: sanitizedSpec.encoding.value.aggregate,
    },
    style: {
      colors: Array.isArray(sanitizedSpec.style?.palette) ? sanitizedSpec.style.palette : [],
      fontSize: (barConfig.value as { labelFontSize?: number }).labelFontSize ?? 12,
      fontFamily: sanitizedSpec.style?.fontFamily,
      legendPosition: "right",
      grid: (barConfig.value as { showGridlines?: boolean }).showGridlines
        ?? (scatterConfig.value as { showGridlines?: boolean }).showGridlines
        ?? true,
      background: (sanitizedSpec.style?.background as string | undefined) ?? "#ffffff",
      layout: sanitizedSpec.layout,
    },
    animation: {
      enabled: primaryAnimationDuration > 0,
      duration: primaryAnimationDuration,
      easing: "easeOutCubic",
    },
    filters: {
      appliedFilters: activeFilters,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    snapshotMeta: {
      totalFilteredRows: previewFilteredRows.length,
      storedFilteredRows: filteredSnapshot.length,
      truncated: previewFilteredRows.length > filteredSnapshot.length,
    },
  };

  return {
    ...sanitizedSpec,
    numberFormat: sanitizedSpec.style?.numberFormat ?? 'default',
    barConfig: barConfig.value,
    lineConfig: lineConfig.value,
    areaConfig: areaConfig.value,
    scatterConfig: scatterConfig.value,
    pieConfig: pieConfig.value,
    mapConfig: mapConfig.value,
    bubbleConfig: bubbleConfig.value,
    dotDonutConfig: dotDonutConfig.value,
    orbitDonutConfig: orbitDonutConfig.value,
    stackedBarConfig: stackedBarConfig.value,
    stackedAreaConfig: stackedAreaConfig.value,
    chartState,
    persistedState: {
      datasetId,
      datasetName: selectedDatasetName.value,
      allRows: previewRows.slice(0, MAX_FILTERED_SNAPSHOT_ROWS),
      filteredRows: filteredSnapshot,
      activeFilters,
      totalRows: previewRows.length,
      filteredRowCount: previewFilteredRows.length,
      snapshotTruncated: previewFilteredRows.length > filteredSnapshot.length,
      ...(previewImageDataUrl ? { previewImageDataUrl } : {}),
    },
  };
}

function applyChartConfig(config: Record<string, unknown>): void {
  const nextSpec = (config as { type?: ChartSpec["type"] }) ?? {};

  if (nextSpec && typeof nextSpec === "object") {
    spec.value = {
      ...spec.value,
      ...(nextSpec as ChartSpec),
    };
    selectedChartType.value = spec.value.type;
  }

  if (typeof config.numberFormat === 'string') {
    spec.value = {
      ...spec.value,
      style: {
        ...(spec.value.style ?? {}),
        numberFormat: config.numberFormat as any,
      },
    } as ChartSpec;
  }

  if (config.barConfig && typeof config.barConfig === "object") {
    barConfig.value = { ...barConfig.value, ...(config.barConfig as typeof barConfig.value) };
  }
  if (config.lineConfig && typeof config.lineConfig === "object") {
    lineConfig.value = { ...lineConfig.value, ...(config.lineConfig as Record<string, unknown>) };
  }
  if (config.areaConfig && typeof config.areaConfig === "object") {
    areaConfig.value = { ...areaConfig.value, ...(config.areaConfig as Record<string, unknown>) };
  }
  if (config.scatterConfig && typeof config.scatterConfig === "object") {
    scatterConfig.value = { ...scatterConfig.value, ...(config.scatterConfig as ScatterBuilderConfig) };
  }
  if (config.pieConfig && typeof config.pieConfig === "object") {
    pieConfig.value = { ...pieConfig.value, ...(config.pieConfig as PieConfig) };
  }
  if (config.mapConfig && typeof config.mapConfig === "object") {
    mapConfig.value = { ...mapConfig.value, ...(config.mapConfig as MapConfig) };
  }
  if (config.bubbleConfig && typeof config.bubbleConfig === "object") {
    bubbleConfig.value = { ...bubbleConfig.value, ...(config.bubbleConfig as BubbleChartConfig) };
  }
  if (config.dotDonutConfig && typeof config.dotDonutConfig === "object") {
    dotDonutConfig.value = { ...dotDonutConfig.value, ...(config.dotDonutConfig as DotDonutConfig) };
  }
  if (config.orbitDonutConfig && typeof config.orbitDonutConfig === "object") {
    orbitDonutConfig.value = { ...orbitDonutConfig.value, ...(config.orbitDonutConfig as OrbitDonutConfig) };
  }
  if (config.stackedBarConfig && typeof config.stackedBarConfig === "object") {
    stackedBarConfig.value = { ...stackedBarConfig.value, ...(config.stackedBarConfig as StackedBarConfig) };
  }
  if (config.stackedAreaConfig && typeof config.stackedAreaConfig === "object") {
    stackedAreaConfig.value = { ...stackedAreaConfig.value, ...(config.stackedAreaConfig as Record<string, unknown>) };
  }
}

async function loadSavedCharts(projectId: string): Promise<void> {
  if (!projectId) {
    savedCharts.value = [];
    return;
  }

  try {
    savedCharts.value = await chartService.getCharts(projectId);
  } catch {
    savedCharts.value = [];
  }
}

async function restoreChartById(chartId: string): Promise<void> {
  if (!chartId) {
    return;
  }

  isRestoringChart.value = true;
  saveErrorMessage.value = null;
  saveSuccessMessage.value = "Restoring chart...";

  try {
    const chart = await chartService.getChart(chartId);
    const parsedConfig = JSON.parse(chart.configJson) as Record<string, unknown>;
    const parsedStyle = JSON.parse(chart.styleJson) as Record<string, unknown>;
    const savedState = (parsedConfig.chartState as SavedChartState | undefined) ?? undefined;
    const persistedState = (parsedConfig.persistedState as {
      allRows?: Record<string, unknown>[];
      filteredRows?: Record<string, unknown>[];
      activeFilters?: Array<{ column: string; values: string[] }>;
    } | undefined) ?? undefined;
    const restoreRows = savedState?.filteredData
      ?? persistedState?.allRows
      ?? persistedState?.filteredRows
      ?? [];
    const sanitizedSpec = sanitizeSpecForSave(parsedConfig as unknown as ChartSpec, restoreRows);
    const normalizedConfig = {
      ...parsedConfig,
      ...sanitizedSpec,
    };

    currentChartId.value = chart.id;
    applyChartConfig(normalizedConfig);

    const savedConfig = savedState?.config;
    if (savedConfig?.xAxis && savedConfig?.yAxis) {
      spec.value = {
        ...spec.value,
        encoding: {
          category: { field: savedConfig.xAxis },
          value: {
            field: savedConfig.yAxis,
            aggregate: savedConfig.aggregation as ChartSpec["encoding"]["value"]["aggregate"],
          },
          ...(savedConfig.groupBy ? { series: { field: savedConfig.groupBy } } : {}),
        },
      };
    }

    spec.value = {
      ...spec.value,
      id: chart.id,
      title: chart.name,
      type: chart.chartType as ChartSpec["type"],
      style: {
        ...(spec.value.style ?? {}),
        ...(parsedStyle ?? {}),
      },
    };

    let datasetLoaded = false;
    if (chart.datasetId) {
      try {
        await selectDatasetById(chart.datasetId);
        datasetLoaded = true;
      } catch {
        datasetLoaded = false;
      }
    }

    if (!datasetLoaded) {
      const snapshotRows = savedState?.filteredData
        ?? (parsedConfig.persistedState as { filteredRows?: Record<string, unknown>[] } | undefined)?.filteredRows
        ?? [];

      if (Array.isArray(snapshotRows) && snapshotRows.length > 0) {
        applyRowsToSpec(snapshotRows);
        saveSuccessMessage.value = "Dataset missing. Restored chart from saved filtered snapshot.";
      }
    }

    await applySavedFilters(savedState?.filters?.appliedFilters ?? persistedState?.activeFilters ?? []);

    refreshPreview();
    lastSavedFingerprint.value = toStableJson({
      projectId: currentProjectId.value,
      datasetId: selectedDatasetId.value,
      chartId: currentChartId.value,
      spec: spec.value,
      chartConfigs: {
        barConfig: barConfig.value,
        lineConfig: lineConfig.value,
        areaConfig: areaConfig.value,
        scatterConfig: scatterConfig.value,
        pieConfig: pieConfig.value,
        mapConfig: mapConfig.value,
        bubbleConfig: bubbleConfig.value,
        dotDonutConfig: dotDonutConfig.value,
        orbitDonutConfig: orbitDonutConfig.value,
        stackedBarConfig: stackedBarConfig.value,
        stackedAreaConfig: stackedAreaConfig.value,
      },
    });
    isDirty.value = false;
    saveSuccessMessage.value = "Chart restored successfully.";
  } catch (error) {
    if (isMissingChartError(error)) {
      clearPersistedChartReference(chartId, currentProjectId.value);
    }
    saveSuccessMessage.value = null;
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to restore chart.");
  } finally {
    isRestoringChart.value = false;
  }
}

async function restoreLastSavedChartForProject(projectId: string): Promise<void> {
  if (!projectId || currentChartId.value || queryValue(route.query.chartId)) {
    return;
  }

  const lastSavedChartId = readLastSavedChart(projectId);
  if (!lastSavedChartId) {
    return;
  }

  const exists = savedCharts.value.some((chart) => chart.id === lastSavedChartId);
  if (!exists) {
    clearPersistedChartReference(lastSavedChartId, projectId);
    return;
  }

  await restoreChartById(lastSavedChartId);
}

async function loadAvailableProjects(): Promise<void> {
  const projects = await projectService.getProjects();
  availableProjects.value = projects;

  const currentId = projectStore.currentProject?.id;
  const matchedCurrent = currentId
    ? projects.find((project) => project.id === currentId)
    : null;

  if (matchedCurrent) {
    projectStore.setCurrentProject({ id: matchedCurrent.id, name: matchedCurrent.name });
    return;
  }

  const first = projects[0];
  if (first) {
    projectStore.setCurrentProject({ id: first.id, name: first.name });
  } else {
    projectStore.setCurrentProject(null);
  }
}

function disposeDatasetBlobUrl(): void {
  if (datasetBlobUrl.value) {
    URL.revokeObjectURL(datasetBlobUrl.value);
    datasetBlobUrl.value = null;
  }
}

function toRowArray(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
  }

  if (typeof value === "object" && value !== null) {
    const maybeWrappedData = (value as { data?: unknown; rows?: unknown }).data;
    const maybeRows = (value as { data?: unknown; rows?: unknown }).rows;
    if (Array.isArray(maybeRows)) {
      return maybeRows.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    }
    if (Array.isArray(maybeWrappedData)) {
      return maybeWrappedData.filter((item) => typeof item === "object" && item !== null) as Record<string, unknown>[];
    }
  }

  return [];
}

function applyRowsToSpec(rows: Record<string, unknown>[]): void {
  disposeDatasetBlobUrl();
  datasetBlobUrl.value = null;
  const inlineRows = rows.slice(0, MAX_INLINE_SOURCE_ROWS);
  const nextSource = buildInlineJsonDataUrl(inlineRows);

  const keys = Object.keys(rows[0] ?? {});
  const currentCategory = spec.value.encoding.category.field;
  const currentValue = spec.value.encoding.value.field;
  const currentSeries = spec.value.encoding.series?.field;

  const categoryField = keys.includes(currentCategory) ? currentCategory : (keys[0] ?? "category");
  const valueField = keys.includes(currentValue) ? currentValue : (keys[1] ?? keys[0] ?? "value");
  const seriesField = currentSeries && keys.includes(currentSeries) ? currentSeries : undefined;

  spec.value = {
    ...spec.value,
    data: {
      ...spec.value.data,
      provider: "json",
      kind: "json",
      query: {
        ...spec.value.data.query,
        source: nextSource,
      },
    },
    encoding: {
      category: { field: categoryField },
      value: { field: valueField, aggregate: spec.value.encoding.value.aggregate ?? "sum" },
      ...(seriesField ? { series: { field: seriesField } } : {}),
    },
  };

  refreshPreview();
}

function getPreviewRows(): Record<string, unknown>[] {
  const raw = (previewRef.value as any)?.rows;
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }

  if (Array.isArray(raw?.value)) {
    return raw.value as Record<string, unknown>[];
  }

  return [];
}

function getPreviewFilteredRows(): Record<string, unknown>[] {
  const raw = (previewRef.value as any)?.filteredRows;
  if (Array.isArray(raw)) {
    return raw as Record<string, unknown>[];
  }

  if (Array.isArray(raw?.value)) {
    return raw.value as Record<string, unknown>[];
  }

  return [];
}

async function loadDatasetsForProject(projectId: string, options?: { skipAutoSelect?: boolean }): Promise<void> {
  if (!projectId) {
    availableDatasets.value = [];
    selectedDatasetId.value = "";
    selectedDatasetName.value = "";
    disposeDatasetBlobUrl();
    return;
  }

  isLoadingDatasets.value = true;
  try {
    const datasets = await datasetService.getDatasetsByProject(projectId);
    availableDatasets.value = datasets;

    const stillExists = datasets.some((dataset) => dataset.id === selectedDatasetId.value);
    if (!stillExists) {
      selectedDatasetId.value = "";
      selectedDatasetName.value = "";
      disposeDatasetBlobUrl();
    }

    if (options?.skipAutoSelect || Boolean(getPendingRestoreChartId(projectId))) {
      return;
    }

    const persistedDatasetId = getPersistedDataset(projectId);
    if (persistedDatasetId && datasets.some((dataset) => dataset.id === persistedDatasetId)) {
      await selectDatasetById(persistedDatasetId);
      return;
    }

    const globalSelectedDatasetId = getGlobalSelectedDataset();
    if (globalSelectedDatasetId && datasets.some((dataset) => dataset.id === globalSelectedDatasetId)) {
      await selectDatasetById(globalSelectedDatasetId);
      return;
    }

    if (!selectedDatasetId.value && datasets.length > 0) {
      selectedDatasetId.value = datasets[0].id;
      selectedDatasetName.value = datasets[0].name;
      await selectDatasetById(datasets[0].id);
    }
  } catch (error) {
    availableDatasets.value = [];
    selectedDatasetId.value = "";
    selectedDatasetName.value = "";
    disposeDatasetBlobUrl();
    saveSuccessMessage.value = null;
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to load datasets for the selected project.");
  } finally {
    isLoadingDatasets.value = false;
  }
}

async function selectDatasetById(datasetId: string): Promise<void> {
  if (!datasetId) {
    selectedDatasetId.value = "";
    selectedDatasetName.value = "";
    disposeDatasetBlobUrl();
    clearPersistedDataset(currentProjectId.value);
    return;
  }

  try {
    const dataset = await datasetService.getDataset(datasetId);
    const parsed = JSON.parse(dataset.dataJson) as unknown;
    const rows = toRowArray(parsed);

    if (rows.length === 0) {
      throw new Error("Selected dataset contains no tabular rows.");
    }

    selectedDatasetId.value = dataset.id;
    selectedDatasetName.value = dataset.name;
    applyRowsToSpec(rows);
    persistSelectedDataset(currentProjectId.value, dataset.id);
    localStorage.setItem(GLOBAL_SELECTED_DATASET_KEY, dataset.id);
    saveErrorMessage.value = null;
  } catch (error) {
    selectedDatasetId.value = "";
    selectedDatasetName.value = "";
    disposeDatasetBlobUrl();
    clearPersistedDataset(currentProjectId.value);
    saveSuccessMessage.value = null;
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to load selected dataset.");
  }
}

async function handleSelectDataset(event: Event): Promise<void> {
  const datasetId = (event.target as HTMLSelectElement).value;
  await selectDatasetById(datasetId);
}

function handleOpenDatasetUpload(): void {
  if (!currentProjectId.value) {
    saveSuccessMessage.value = null;
    saveErrorMessage.value = "Please select or create a project first.";
    return;
  }

  showDatasetUploadPanel.value = true;
}

function handleOpenManualDatasetEditor(): void {
  if (!currentProjectId.value) {
    saveSuccessMessage.value = null;
    saveErrorMessage.value = "Please select or create a project first.";
    return;
  }

  showManualDatasetEditor.value = true;
}

function handleCancelDatasetUpload(): void {
  showDatasetUploadPanel.value = false;
}

async function handleDatasetUploadSuccess(created: DatasetRecord): Promise<void> {
  availableDatasets.value = [created, ...availableDatasets.value.filter((dataset) => dataset.id !== created.id)];
  showDatasetUploadPanel.value = false;
  await selectDatasetById(created.id);
  saveErrorMessage.value = null;
  saveSuccessMessage.value = `Dataset \"${created.name}\" uploaded and selected.`;
}

function handleDatasetUploadError(message: string): void {
  saveSuccessMessage.value = null;
  saveErrorMessage.value = message || "Failed to upload dataset.";
}

async function handleManualDatasetSaved(payload: {
  dataset: DatasetRecord;
  suggestedChartType: string;
  suggestedEncoding: { category?: string; value?: string; series?: string };
}): Promise<void> {
  const created = payload.dataset;

  availableDatasets.value = [created, ...availableDatasets.value.filter((dataset) => dataset.id !== created.id)];
  await selectDatasetById(created.id);

  if (payload.suggestedChartType) {
    updateType(payload.suggestedChartType as ChartSpec["type"]);
  }

  if (payload.suggestedEncoding.category && payload.suggestedEncoding.value) {
    updateEncoding({
      category: payload.suggestedEncoding.category,
      value: payload.suggestedEncoding.value,
      series: payload.suggestedEncoding.series,
    });
  }

  saveErrorMessage.value = null;
  saveSuccessMessage.value = `Dataset \"${created.name}\" saved and selected.`;
  showManualDatasetEditor.value = false;
  showDatasetUploadPanel.value = false;
}

function handleManualDatasetEditorError(message: string): void {
  saveSuccessMessage.value = null;
  saveErrorMessage.value = message || "Failed to save manual dataset.";
}

function handleSelectProject(event: Event): void {
  const selectedId = (event.target as HTMLSelectElement).value;
  const selected = availableProjects.value.find((project) => project.id === selectedId);

  if (!selected) {
    projectStore.setCurrentProject(null);
    return;
  }

  projectStore.setCurrentProject({ id: selected.id, name: selected.name });
}

async function handleCreateProject() {
  const name = newProjectName.value.trim();
  if (!name) return;

  try {
    const created = await projectService.createProject({ name });
    availableProjects.value = [created, ...availableProjects.value];
    projectStore.setCurrentProject({ id: created.id, name: created.name });
    newProjectName.value = "";
    saveErrorMessage.value = null;
  } catch (error) {
    saveSuccessMessage.value = null;
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to create project.");
  }
}

async function saveChartCore(options?: { silent?: boolean }): Promise<ChartRecord | null> {
  if (isSavingChart.value || isRestoringChart.value) {
    return null;
  }

  const activeProjectId = projectStore.currentProject?.id;
  if (!activeProjectId) {
    if (!options?.silent) {
      saveSuccessMessage.value = null;
      saveErrorMessage.value = "Please select or create a project first.";
    }
    return null;
  }

  let datasetId = selectedDatasetId.value;
  if (!datasetId && availableDatasets.value.length > 0) {
    await selectDatasetById(availableDatasets.value[0].id);
    datasetId = selectedDatasetId.value;
  }

  if (!datasetId) {
    const persistedDatasetId = getPersistedDataset(activeProjectId);
    const globalDatasetId = getGlobalSelectedDataset();
    const fallbackDatasetId = persistedDatasetId || globalDatasetId;

    if (fallbackDatasetId) {
      await selectDatasetById(fallbackDatasetId);
      datasetId = selectedDatasetId.value;
    }
  }

  if (!datasetId) {
    if (!options?.silent) {
      saveSuccessMessage.value = null;
      saveErrorMessage.value = "Please select a dataset before saving.";
    }
    return null;
  }

  isSavingChart.value = true;
  isPersistingChart.value = true;
  if (!options?.silent) {
    saveSuccessMessage.value = null;
    saveErrorMessage.value = null;
  }

  try {
    const chartName = spec.value.title?.trim() || "Untitled Chart";
    const selectedType = spec.value.type;
    const previewImageDataUrl = capturePreviewImageDataUrl();
    const chartConfig = getChartConfigPayload(datasetId, previewImageDataUrl);
    const chartStyle = { ...spec.value.style };
    const savePayload = {
      name: chartName,
      chartType: selectedType,
      configJson: JSON.stringify(chartConfig),
      styleJson: JSON.stringify(chartStyle),
      datasetId,
      projectId: activeProjectId,
    };

    console.debug("Preparing chart save payload", {
      chart: {
        id: currentChartId.value || spec.value.id || null,
        name: chartName,
        chartType: selectedType,
        projectId: activeProjectId,
        datasetId,
        config: chartConfig,
        style: chartStyle,
      },
      hasPreviewImage: Boolean(previewImageDataUrl),
      filteredRowsSaved: (chartConfig.chartState as SavedChartState | undefined)?.filteredData?.length ?? 0,
    });

    let saved: ChartRecord;
    if (currentChartId.value) {
      try {
        saved = await chartService.updateChart(currentChartId.value, savePayload);
      } catch (error) {
        if (!isMissingChartError(error)) {
          throw error;
        }

        console.warn("Current chart no longer exists. Creating a new saved chart.", {
          chartId: currentChartId.value,
          projectId: activeProjectId,
        });

        clearPersistedChartReference(currentChartId.value, activeProjectId);
        saved = await chartService.createChart(savePayload);
      }
    } else {
      saved = await chartService.createChart(savePayload);
    }

    currentChartId.value = saved.id;
    spec.value = { ...spec.value, id: saved.id };
    lastSavedFingerprint.value = toStableJson({
      projectId: activeProjectId,
      datasetId,
      chartId: saved.id,
      spec: spec.value,
      chartConfigs: {
        barConfig: barConfig.value,
        lineConfig: lineConfig.value,
        areaConfig: areaConfig.value,
        scatterConfig: scatterConfig.value,
        pieConfig: pieConfig.value,
        mapConfig: mapConfig.value,
        bubbleConfig: bubbleConfig.value,
        dotDonutConfig: dotDonutConfig.value,
        orbitDonutConfig: orbitDonutConfig.value,
        stackedBarConfig: stackedBarConfig.value,
        stackedAreaConfig: stackedAreaConfig.value,
      },
    });
    rememberLastSavedChart(activeProjectId, saved.id);
    chartBuilderStore.setDraft({
      chartId: saved.id,
      projectId: activeProjectId,
      datasetId,
      spec: sanitizeSpecForSave(spec.value, getPreviewRows()),
      chartConfigs: {
        barConfig: barConfig.value,
        lineConfig: lineConfig.value,
        areaConfig: areaConfig.value,
        scatterConfig: scatterConfig.value,
        pieConfig: pieConfig.value,
        mapConfig: mapConfig.value,
        bubbleConfig: bubbleConfig.value,
        dotDonutConfig: dotDonutConfig.value,
        orbitDonutConfig: orbitDonutConfig.value,
        stackedBarConfig: stackedBarConfig.value,
        stackedAreaConfig: stackedAreaConfig.value,
      },
    });
    isDirty.value = false;

    await loadSavedCharts(activeProjectId);
    broadcastChartPersistence(activeProjectId, saved.id, "saved");

    if (!options?.silent) {
      saveSuccessMessage.value = `Chart \"${saved.name}\" saved successfully.`;
    }

    console.debug("Chart saved", {
      chartId: saved.id,
      projectId: activeProjectId,
      datasetId,
      updatedAt: saved.updatedAt,
    });

    return saved;
  } catch (error) {
    if (!options?.silent) {
      console.error("Save chart failed:", error);
      saveErrorMessage.value = getApiErrorMessage(error, "Failed to save chart.");
    }

    return null;
  } finally {
    isPersistingChart.value = false;
    isSavingChart.value = false;
  }
}

async function saveChart(): Promise<void> {
  await saveChartCore({ silent: false });
}

async function addToReport(): Promise<void> {
  const saved = await saveChartCore({ silent: false });
  if (!saved) {
    return;
  }

  await router.push({
    path: "/report",
    query: {
      chartId: saved.id,
      projectId: currentProjectId.value,
    },
  });
}

async function handleEditSavedChart(chartId: string): Promise<void> {
  const targetQuery = {
    ...route.query,
    chartId,
  };

  await router.replace({ query: targetQuery });
  await restoreChartById(chartId);
}

async function handleDeleteSavedChart(chartId: string): Promise<void> {
  const target = savedCharts.value.find((chart) => chart.id === chartId);
  const confirmed = window.confirm(`Delete chart "${target?.name ?? "Untitled chart"}"?`);
  if (!confirmed) {
    return;
  }

  try {
    await chartService.deleteChart(chartId);
    clearPersistedChartReference(chartId, currentProjectId.value);
    if (currentChartId.value === chartId) {
      currentChartId.value = "";
      isDirty.value = false;
    }
    await loadSavedCharts(currentProjectId.value);
    broadcastChartPersistence(currentProjectId.value, chartId, "deleted");
    saveSuccessMessage.value = "Chart deleted.";
  } catch (error) {
    saveErrorMessage.value = getApiErrorMessage(error, "Failed to delete chart.");
  }
}

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

async function handleDatasetStorageSync(event: StorageEvent): Promise<void> {
  if (!currentProjectId.value) {
    return;
  }

  const projectDatasetKey = getDatasetStorageKey(currentProjectId.value);
  if (event.key !== DATASET_SYNC_SIGNAL_KEY && event.key !== projectDatasetKey && event.key !== GLOBAL_SELECTED_DATASET_KEY) {
    return;
  }

  await loadDatasetsForProject(currentProjectId.value);
}

async function handleWindowFocus(): Promise<void> {
  if (!currentProjectId.value) {
    return;
  }

  await loadDatasetsForProject(currentProjectId.value);
}

function handleBeforeUnload(event: BeforeUnloadEvent): void {
  if (!isDirty.value) {
    return;
  }

  event.preventDefault();
  event.returnValue = "You have unsaved changes. Save before leaving?";
}

onMounted(async () => {
  document.addEventListener('click', handleDocClick, true);
  window.addEventListener('storage', handleDatasetStorageSync);
  window.addEventListener('focus', handleWindowFocus);
  window.addEventListener('beforeunload', handleBeforeUnload);

  try {
    await loadAvailableProjects();
    await loadDatasetsForProject(currentProjectId.value, { skipAutoSelect: Boolean(getPendingRestoreChartId(currentProjectId.value)) });
    await loadSavedCharts(currentProjectId.value);
    if (queryValue(route.query.chartId)) {
      await applyIncomingChartFromRoute();
    } else {
      await restoreDraftFromStore();
      await applyIncomingDatasetFromRoute();
      await restoreLastSavedChartForProject(currentProjectId.value);
    }
  } catch {
    availableProjects.value = [];
    availableDatasets.value = [];
    savedCharts.value = [];
  }
});
onBeforeUnmount(() => {
  document.removeEventListener('click', handleDocClick, true);
  window.removeEventListener('storage', handleDatasetStorageSync);
  window.removeEventListener('focus', handleWindowFocus);
  window.removeEventListener('beforeunload', handleBeforeUnload);
  disposeDatasetBlobUrl();
});

watch(
  () => currentProjectId.value,
  async (projectId) => {
    await loadDatasetsForProject(projectId, { skipAutoSelect: Boolean(getPendingRestoreChartId(projectId)) });
    await loadSavedCharts(projectId);

    if (!routeAutoLoadApplied.value && queryValue(route.query.datasetId)) {
      await applyIncomingDatasetFromRoute();
    }

    if (queryValue(route.query.chartId)) {
      await applyIncomingChartFromRoute();
    }

    await restoreLastSavedChartForProject(projectId);
  }
);

watch(
  () => responsiveStore.deviceType,
  (deviceType) => {
    showSidebar.value = deviceType !== 'mobile';
  },
  { immediate: true }
);

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

const persistenceSnapshot = computed(() => ({
  projectId: currentProjectId.value,
  datasetId: selectedDatasetId.value,
  chartId: currentChartId.value,
  spec: spec.value,
  chartConfigs: {
    barConfig: barConfig.value,
    lineConfig: lineConfig.value,
    areaConfig: areaConfig.value,
    scatterConfig: scatterConfig.value,
    pieConfig: pieConfig.value,
    mapConfig: mapConfig.value,
    bubbleConfig: bubbleConfig.value,
    dotDonutConfig: dotDonutConfig.value,
    orbitDonutConfig: orbitDonutConfig.value,
    stackedBarConfig: stackedBarConfig.value,
    stackedAreaConfig: stackedAreaConfig.value,
  },
}));

watch(
  persistenceSnapshot,
  (snapshot) => {
    const nextFingerprint = toStableJson(snapshot);

    if (isRestoringChart.value || isPersistingChart.value) {
      return;
    }

    isDirty.value = nextFingerprint !== lastSavedFingerprint.value;
  },
  { deep: true }
);

onBeforeRouteLeave(async () => {
  if (!isDirty.value) {
    return true;
  }

  const shouldSave = window.confirm("You have unsaved changes. Save before leaving?");
  if (shouldSave) {
    const saved = await saveChartCore({ silent: false });
    if (saved) {
      return true;
    }

    return window.confirm("Save failed. Leave this page and discard unsaved changes?");
  }

  return true;
});

function updateType(type: ChartSpec["type"]) {
  selectedChartType.value = type;
  // When switching to certain chart types, suggest sensible default layout presets.
  if (type === 'orbitDonut') {
    spec.value = { ...spec.value, type, layout: { ...spec.value.layout, preset: 'grid' } };
  } else if (type === 'dotDonut') {
    spec.value = { ...spec.value, type, layout: { ...spec.value.layout, preset: 'grid' } };
  } else if (type === 'scatter') {
    spec.value = { 
      ...spec.value, 
      type, 
      encoding: { 
        category: { field: "gdpPerCapita", label: "GDP Per Capita" }, 
        value: { field: "lifeExpectancy", label: "Life Expectancy", aggregate: "none" },
        series: { field: "region" }
      } 
    };
  } else {
    spec.value = { ...spec.value, type };
  }
  
  // Auto-merge/Validate config for the selected type
  if (['line', 'area', 'stackedArea'].includes(type)) {
      if (type === 'line') lineConfig.value = validateConfigForType('line', lineConfig.value);
      if (type === 'area') areaConfig.value = validateConfigForType('area', areaConfig.value);
      if (type === 'stackedArea') stackedAreaConfig.value = validateConfigForType('stackedArea', stackedAreaConfig.value);
  }

  refreshPreview();
}

function applyPreset(payload: { type: ChartSpec["type"]; layoutPreset?: "single" | "horizontal" | "vertical" | "grid" | "smallMultiples"; mode?: "grouped" | "stacked" | "percent" | "simple" }) {
  selectedChartType.value = payload.type;
  const nextStyle = { ...spec.value.style } as any;
  if (payload.mode) nextStyle.mode = payload.mode;
  const currentLayout = spec.value.layout || { preset: "single" };
  const nextLayout = { ...currentLayout, preset: payload.layoutPreset ?? currentLayout.preset };
  spec.value = { ...spec.value, type: payload.type, style: nextStyle, layout: nextLayout } as ChartSpec;
  refreshPreview();
}

function canMovePastTypeStep(): boolean {
  return activeStep.value !== 2 || !!selectedChartType.value;
}

function goToStep(stepId: number): void {
  if (stepId > 2 && !selectedChartType.value) {
    activeStep.value = 2;
    return;
  }

  activeStep.value = stepId;
}

function goToNextStep(): void {
  if (!canMovePastTypeStep()) {
    return;
  }

  activeStep.value = Math.min(4, activeStep.value + 1);
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

function updateScatterConfig(next: ScatterBuilderConfig) {
  scatterConfig.value = next;
}

function updatePieConfig(next: PieConfig) {
  pieConfig.value = next;
}

function updateMapConfig(next: MapConfig) {
  mapConfig.value = next;
}

function updateBubbleConfig(next: BubbleChartConfig) {
  bubbleConfig.value = next;
}

function updateDotDonutConfig(next: DotDonutConfig) {
  dotDonutConfig.value = next;
}

function updateOrbitDonutConfig(next: OrbitDonutConfig) {
  orbitDonutConfig.value = next;
}

function updateStackedBarConfig(next: StackedBarConfig) {
  stackedBarConfig.value = next;
}

function updateStackedAreaConfig(next: any) {
  stackedAreaConfig.value = next;
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


const previewRef = ref<InstanceType<typeof PreviewPane> | null>(null);

const sidebarActiveFilters = computed<Array<{ column: string; values: string[] }>>(() => {
  const raw = (previewRef.value as any)?.activeFilters;
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.value)) return raw.value;
  return [];
});

const sidebarTotalFiltered = computed<number>(() => {
  const raw = (previewRef.value as any)?.totalFiltered;
  if (typeof raw === "number") return raw;
  if (typeof raw?.value === "number") return raw.value;
  return 0;
});

const sidebarTotalRows = computed<number>(() => {
  const raw = (previewRef.value as any)?.rows;
  if (Array.isArray(raw)) return raw.length;
  if (Array.isArray(raw?.value)) return raw.value.length;
  return 0;
});

function clearSidebarFilter(column: string) {
  (previewRef.value as any)?.clearValueFilter?.(column);
}

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
      const filteredData = getPreviewFilteredRows();
      const animationDuration = [
        (barConfig.value as { animationDuration?: number }).animationDuration,
        (lineConfig.value as { animationDuration?: number }).animationDuration,
        (areaConfig.value as { animationDuration?: number }).animationDuration,
        (scatterConfig.value as { animationDuration?: number }).animationDuration,
        (pieConfig.value as { animationDuration?: number }).animationDuration,
        (mapConfig.value as { animationDuration?: number }).animationDuration,
        (stackedBarConfig.value as { animationDuration?: number }).animationDuration,
      ].find((value) => typeof value === "number" && value >= 0) ?? 0;

      const blob = await exportService.exportHTML(
        svg,
        spec.value,
        {
          data: filteredData,
          config: {
            type: spec.value.type,
            axes: spec.value.encoding,
            layout: spec.value.layout,
            mappings: spec.value.encoding,
            title: spec.value.title,
          },
          style: {
            ...(spec.value.style ?? {}),
            chartConfigs: {
              barConfig: barConfig.value,
              lineConfig: lineConfig.value,
              areaConfig: areaConfig.value,
              scatterConfig: scatterConfig.value,
              pieConfig: pieConfig.value,
              mapConfig: mapConfig.value,
              bubbleConfig: bubbleConfig.value,
              dotDonutConfig: dotDonutConfig.value,
              orbitDonutConfig: orbitDonutConfig.value,
              stackedBarConfig: stackedBarConfig.value,
              stackedAreaConfig: stackedAreaConfig.value,
            },
          },
          animation: {
            enabled: animationDuration > 0,
            duration: animationDuration,
            easing: "easeOutCubic",
          },
          metadata: {
            title: spec.value.title,
            source: selectedDatasetName.value || selectedDatasetId.value,
            exportedAt: new Date().toISOString(),
            chartId: currentChartId.value || spec.value.id,
            projectId: currentProjectId.value,
            datasetId: selectedDatasetId.value,
            filters: sidebarActiveFilters.value,
          },
        },
      );
      await downloadBlob(blob, `${baseName}.html`);
    } else if (format === "spec-json") {
      const blob = await exportService.exportSpec(spec.value);
      await downloadBlob(blob, `${baseName}-spec.json`);
    } else if (format === "project-json") {
      const data = getPreviewRows();
      const filteredData = getPreviewFilteredRows();
      const blob = await exportService.exportProject(spec.value, data, {
        selectedDatasetId: selectedDatasetId.value,
        selectedDatasetName: selectedDatasetName.value,
        activeFilters: sidebarActiveFilters.value,
        chartType: spec.value.type,
        style: spec.value.style,
        filteredData,
      });
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

    const embeddedData = Array.isArray(project.filteredData)
      ? project.filteredData
      : Array.isArray(project.data)
        ? project.data
        : [];

    // If data is embedded, convert to an inline JSON data URL that survives reloads.
    if (embeddedData.length > 0) {
      spec.value.data.query.source = buildInlineJsonDataUrl(embeddedData);
    }

    if (typeof project.selectedDatasetId === "string" && project.selectedDatasetId.length > 0) {
      selectedDatasetId.value = project.selectedDatasetId;
      localStorage.setItem(GLOBAL_SELECTED_DATASET_KEY, project.selectedDatasetId);
      persistSelectedDataset(currentProjectId.value, project.selectedDatasetId);
    }

    if (typeof project.selectedDatasetName === "string") {
      selectedDatasetName.value = project.selectedDatasetName;
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

function toggleSidebar(): void {
  showSidebar.value = !showSidebar.value;
}
</script>

<template>
  <main class="page" :class="[`page--${responsiveStore.deviceType}`]">
    <header class="page__header">
      <div>
        <p class="eyebrow">Chart Builder</p>
        <h1>ECAStats Chart Builder</h1>
        <p class="muted">Choose type of Graph, configure, preview and export.</p>
      </div>
      <div class="page__actions" style="display:flex;gap:8px;align-items:center">
        <button
          v-if="responsiveStore.deviceType === 'mobile'"
          class="btn btn--outline"
          @click="toggleSidebar"
        >
          {{ showSidebar ? 'Hide Controls' : 'Show Controls' }}
        </button>

        <button class="btn btn--primary" :disabled="isSavingChart || isRestoringChart" @click="saveChart">
          {{ isSavingChart ? 'Saving...' : 'Save Chart' }}
        </button>
        <button class="btn btn--outline" :disabled="isSavingChart || isRestoringChart" @click="addToReport">
          Add to Report
        </button>
        <p v-if="incomingDatasetLoading || isRestoringChart" class="status-text">Preparing dataset and mapping...</p>
        <p v-if="saveSuccessMessage" class="status-text">{{ saveSuccessMessage }}</p>
        <p v-else-if="saveErrorMessage" class="alert-text">{{ saveErrorMessage }}</p>
        <input type="file" ref="projectInputRef" style="display:none" accept="application/json" @change="handleLoadProject" />
        <button v-show="false" class="btn btn--outline" @click="triggerLoadProject">
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
          <button v-show="false" class="icon-btn" title="Fullscreen preview" @click="togglePreviewFullscreen">
            <svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M4 4h6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M4 4v6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M20 20h-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M20 20v-6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </button>
        </div>
      </div>
    </header>

    <section class="layout">
      <div v-if="showSidebar" class="layout__side">
        <!-- Stepper Header -->
        <div class="stepper">
          <div v-for="step in steps" :key="step.id" class="step-item" :class="{ 'step-item--active': activeStep === step.id, 'step-item--completed': activeStep > step.id }">
            <div class="step-number">{{ step.id }}</div>
            <div class="step-line" v-if="step.id < 4"></div>
          </div>
        </div>

        <!-- Step Content Area -->
        <div class="step-content-card">
          <!-- Sub-tabs -->
          <div class="step-tabs">
            <button v-for="step in steps" :key="step.id" class="step-tab" :class="{ 'step-tab--active': activeStep === step.id }" @click="goToStep(step.id)">
              <span class="step-tab__icon"></span> <!-- Add icons later if needed -->
              {{ step.label }}
            </button>
          </div>

          <div class="step-body">
            <!-- Step 1: Data -->
            <div v-if="activeStep === 1">
              <h3 class="panel__title">Project</h3>
              <div class="form-field">
                <span>Selected Project</span>
                <select :value="projectStore.currentProject?.id ?? ''" @change="handleSelectProject">
                  <option value="" disabled>Select a project</option>
                  <option v-for="p in availableProjects" :key="p.id" :value="p.id">{{ p.name }}</option>
                </select>
              </div>
              <div class="form-field" style="margin-top: 8px;">
                <span>New Project</span>
                <div style="display:flex; gap: 4px;">
                  <input type="text" v-model="newProjectName" placeholder="Project name" @keyup.enter="handleCreateProject" />
                  <button class="pill" @click="handleCreateProject">Add</button>
                </div>
              </div>

              <h3 class="panel__title" style="margin-top: 20px;">Dataset</h3>
              <div class="form-field">
                <span>Selected Dataset</span>
                <select :value="selectedDatasetId" @change="handleSelectDataset" :disabled="!currentProjectId || isLoadingDatasets">
                  <option value="" disabled>{{ isLoadingDatasets ? 'Loading datasets...' : 'Select a dataset' }}</option>
                  <option v-for="d in availableDatasets" :key="d.id" :value="d.id">{{ d.name }}</option>
                </select>
              </div>
              <div class="form-field" style="margin-top: 8px;">
                <button class="pill" :disabled="!currentProjectId" @click="handleOpenDatasetUpload">Upload Dataset</button>
                <button class="pill" :disabled="!currentProjectId" @click="handleOpenManualDatasetEditor">Create Dataset Manually</button>
              </div>
              <DatasetUploadPanel
                v-if="showDatasetUploadPanel && currentProjectId"
                :project-id="currentProjectId"
                @uploaded="handleDatasetUploadSuccess"
                @cancel="handleCancelDatasetUpload"
                @error="handleDatasetUploadError"
                @open-manual-editor="handleOpenManualDatasetEditor"
              />
              <p class="muted" style="margin-top:6px;">
                {{ selectedDatasetName ? `Using dataset: ${selectedDatasetName}` : 'Dataset selection feeds DataJson into the chart preview.' }}
              </p>

              <h3 class="panel__title" style="margin-top: 20px;">Saved Charts</h3>
              <div class="saved-chart-list">
                <p v-if="savedCharts.length === 0" class="muted">No saved charts yet for this project.</p>
                <div v-for="chart in savedCharts" :key="chart.id" class="saved-chart-item">
                  <div class="saved-chart-preview">{{ chart.chartType.slice(0, 3).toUpperCase() }}</div>
                  <div class="saved-chart-meta">
                    <strong>{{ chart.name }}</strong>
                    <span>{{ chart.chartType }}</span>
                  </div>
                  <div class="saved-chart-actions">
                    <button class="pill" @click="handleEditSavedChart(chart.id)">Edit</button>
                    <button class="pill pill--danger" @click="handleDeleteSavedChart(chart.id)">Delete</button>
                  </div>
                </div>
              </div>

            </div>

            <!-- Step 2: Type -->
            <div v-if="activeStep === 2">
              <h3 class="panel__title">Select chart type</h3>
              <ChartTypeSelector :selected="selectedChartType" @select="updateType" @preset="applyPreset" />
              <p v-if="!selectedChartType" class="muted" style="margin-top: 8px;">Select a chart type to continue.</p>
            </div>

            <!-- Step 3: Config -->
            <div v-if="activeStep === 3">
              <h3 class="panel__title">Configure options</h3>
              <ChartOptionsPanel 
                :layout="spec.layout" 
                :style="spec.style" 
                :title="spec.title"
                @update:layout="updateLayout" 
                @update:style="updateStyle" 
                @update:title="updateTitle"
              />
            </div>

            <!-- Step 4: Style -->
            <div v-if="activeStep === 4">
              <h3 class="panel__title">Style & Controls</h3>
              <BarBuilderControls v-if="spec.type === 'bar'" :config="barConfig" :fields="dataFields" @update:config="updateBarConfig" />
              <StackedBarBuilderControls v-if="spec.type === 'stackedBar'" :config="stackedBarConfig" @update:config="updateStackedBarConfig" />
              <!-- New Modular Config Panels -->
              <LineChartConfigPanel v-if="spec.type === 'line'" :config="lineConfig" @update:config="updateLineConfig" />
              <AreaChartConfigPanel v-if="spec.type === 'area'" :config="areaConfig" @update:config="updateAreaConfig" />
              <StackedAreaConfigPanel v-if="spec.type === 'stackedArea'" :config="stackedAreaConfig" @update:config="updateStackedAreaConfig" />
              
              <PieBuilderControls v-if="spec.type === 'pie'" :config="pieConfig" @update:config="updatePieConfig" />
              <ScatterBuilderControls v-if="spec.type === 'scatter'" :config="scatterConfig" :fields="dataFields" @update:config="updateScatterConfig" />
              <MapBuilderControls v-if="spec.type === 'map'" :config="mapConfig" @update:config="updateMapConfig" />
              <BubbleBuilderControls v-if="spec.type === 'bubble'" :config="bubbleConfig" @update:config="updateBubbleConfig" />
              <DotDonutBuilderControls v-if="spec.type === 'dotDonut'" :config="dotDonutConfig" @update:config="updateDotDonutConfig" />
              <OrbitDonutBuilderControls v-if="spec.type === 'orbitDonut'" :config="orbitDonutConfig" @update:config="updateOrbitDonutConfig" />
            </div>
          </div>

          <!-- Navigation Footer -->
          <div class="step-footer">
            <button class="btn btn--ghost step-nav-btn" :disabled="activeStep === 1" @click="activeStep--" title="Previous step" aria-label="Previous step">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            </button>
            <button class="btn btn--primary step-nav-btn" v-if="activeStep < 4" :disabled="!canMovePastTypeStep()" @click="goToNextStep" title="Next step" aria-label="Next step">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
          </div>
        </div>

        <div class="selection-summary-card" v-if="sidebarTotalRows > 0">
          <div class="summary-header">
            <div class="summary-icon">📊</div>
            <div>
              <h4 class="summary-title">Data Selection Summary</h4>
              <p class="summary-subtitle">Overview of data used for graph generation</p>
            </div>
          </div>

          <div class="summary-grid">
            <div class="summary-item">
              <span class="summary-label">Rows Selected</span>
              <span class="summary-value" :class="{ 'value--filtered': sidebarActiveFilters.length > 0 }">
                {{ sidebarTotalFiltered }} <small>/ {{ sidebarTotalRows }}</small>
              </span>
            </div>

            <div class="summary-item">
              <span class="summary-label">Mapped Fields</span>
              <div class="mapping-tags">
                <span v-if="spec.encoding.category?.field" class="mapping-tag tag--x">X: {{ spec.encoding.category.field }}</span>
                <span v-if="spec.encoding.value?.field" class="mapping-tag tag--y">Y: {{ spec.encoding.value.field }}</span>
                <span v-if="spec.encoding.series?.field" class="mapping-tag tag--series">Series: {{ spec.encoding.series.field }}</span>
              </div>
            </div>

            <div class="summary-item" v-if="sidebarActiveFilters.length > 0">
              <span class="summary-label">Active Filters</span>
              <div class="filter-tags">
                <div v-for="filter in sidebarActiveFilters" :key="filter.column" class="filter-tag">
                  <span class="filter-col">{{ filter.column }}:</span>
                  <span class="filter-vals">{{ filter.values.join(', ') }}</span>
                  <button class="filter-clear" @click="clearSidebarFilter(filter.column)" title="Clear filter">×</button>
                </div>
              </div>
            </div>
            <div class="summary-item" v-else>
              <span class="summary-label">Active Filters</span>
              <span class="summary-value value--none">None (Showing all data)</span>
            </div>
          </div>
        </div>
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
          :scatter-config="scatterConfig"
          :bubble-config="bubbleConfig"
          :dot-donut-config="dotDonutConfig"
          :orbit-donut-config="orbitDonutConfig"
          :stacked-bar-config="stackedBarConfig"
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

    <ManualDatasetEditor
      v-if="showManualDatasetEditor && currentProjectId"
      :project-id="currentProjectId"
      :dataset="null"
      @close="showManualDatasetEditor = false"
      @saved="handleManualDatasetSaved"
      @error="handleManualDatasetEditorError"
    />
  </main>
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
  padding: 24px;
  position: relative;
  background: white;
  display: flex;
  flex-direction: column;
}

.preview__status-bar {
  margin-bottom: 12px;
  display: none;
}
.status-text {
  font-size: 12px;
  color: #0ea5e9;
  margin: 0;
  display: block;
}
.alert-text {
  font-size: 12px;
  color: #ef4444;
  margin: 0;
}

.preview__frame-wrapper {
  flex: 1;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 20px;
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

.saved-chart-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 8px;
}

.saved-chart-item {
  display: grid;
  grid-template-columns: 46px 1fr auto;
  gap: 8px;
  align-items: center;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px;
  background: #fff;
}

.saved-chart-preview {
  width: 38px;
  height: 38px;
  border-radius: 8px;
  background: #eff6ff;
  color: #1d4ed8;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.saved-chart-meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.saved-chart-meta strong {
  font-size: 13px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.saved-chart-meta span {
  font-size: 12px;
  color: #64748b;
}

.saved-chart-actions {
  display: flex;
  gap: 6px;
}

.pill--danger {
  border-color: #fecaca;
  color: #b91c1c;
  background: #fff5f5;
}

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

/* Stepper UI */
.stepper {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
  padding: 0 16px;
}
.step-item {
  display: flex;
  align-items: center;
  flex: 1;
}
.step-item:last-child {
  flex: 0;
}
.step-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #f1f5f9;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 14px;
  border: 2px solid transparent;
  transition: all 0.2s;
}
.step-item--active .step-number {
  background: #0ea5e9;
  color: white;
  box-shadow: 0 0 0 4px rgba(14, 165, 233, 0.1);
}
.step-item--completed .step-number {
  background: #10b981;
  color: white;
}
.step-line {
  flex: 1;
  height: 2px;
  background: #e2e8f0;
  margin: 0 12px;
}
.step-item--completed .step-line {
  background: #10b981;
}

.selection-summary-card {
  margin-top: 16px;
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
}

.summary-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px solid #f1f5f9;
}

.summary-icon {
  font-size: 1.5rem;
  background: #eff6ff;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}

.summary-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: #1e293b;
}

.summary-subtitle {
  margin: 2px 0 0 0;
  font-size: 0.75rem;
  color: #64748b;
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 24px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.summary-label {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #94a3b8;
}

.summary-value {
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.value--filtered {
  color: #2563eb;
}

.value--none {
  color: #64748b;
  font-style: italic;
  font-size: 0.9rem;
}

.mapping-tags,
.filter-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.mapping-tag {
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
}

.tag--x {
  background: #fee2e2;
  color: #991b1b;
}

.tag--y {
  background: #dcfce7;
  color: #166534;
}

.tag--series {
  background: #fef9c3;
  color: #854d0e;
}

.filter-tag {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #334155;
  max-width: 100%;
}

.filter-col {
  font-weight: 700;
  white-space: nowrap;
}

.filter-vals {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.filter-clear {
  border: none;
  background: none;
  cursor: pointer;
  padding: 0 4px;
  font-size: 1.1rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  transition: color 0.2s;
}

.filter-clear:hover {
  color: #ef4444;
}

/* Content Card */
.step-content-card {
  background: white;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 500px;
}
.step-tabs {
  display: flex;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  padding: 4px;
  gap: 4px;
}
.step-tab {
  flex: 1;
  padding: 8px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  border-radius: 6px;
  border: none;
  background: transparent;
  cursor: pointer;
  transition: all 0.2s;
}
.step-tab:hover {
  background: #f1f5f9;
  color: #0f172a;
}
.step-tab--active {
  background: white;
  color: #0ea5e9;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
}

.step-body {
  flex: 1;
  padding: 20px;
  overflow-y: visible;
}

.layout__side {
  max-height: none;
  overflow: visible;
  padding-right: 0;
}

.step-footer {
  padding: 16px 20px;
  border-top: 1px solid #e2e8f0;
  background: #f8fafc;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.step-nav-btn {
  width: 36px;
  min-width: 36px;
  height: 36px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.step-nav-btn svg {
  margin: 0 !important;
}

.panel--no-fold {
  border: none;
  background: transparent;
}
.panel--no-fold .panel__title {
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: #64748b;
  margin-bottom: 12px;
}

.btn--ghost {
  background: transparent;
  border: none;
  color: #64748b;
  font-weight: 500;
}
.btn--ghost:hover:not(:disabled) {
  background: #f1f5f9;
  color: #0f172a;
}
.btn--ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 1024px) {
  .page__header {
    flex-direction: column;
    align-items: flex-start;
  }

  .layout__main {
    position: static;
  }

  .preview__surface {
    padding: 16px;
  }
}

@media (max-width: 767px) {
  .page {
    padding: 10px;
  }

  .page__actions {
    width: 100%;
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .step-tabs {
    overflow-x: auto;
    white-space: nowrap;
  }

  .step-tab {
    min-width: 110px;
  }

  .step-body {
    padding: 12px;
  }

  .selection-summary-card {
    padding: 12px;
  }
}
</style>
