import api from "./api";

const LOCAL_CHARTS_KEY = "chartBuilder:charts:local-v2";
const LOCAL_FALLBACK_MAX_ROWS = 250;

export type ChartRecord = {
  id: string;
  name: string;
  chartType: string;
  configJson: string;
  styleJson: string;
  datasetId: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

type ApiChart = {
  id?: string;
  Id?: string;
  name?: string;
  Name?: string;
  chartType?: string;
  ChartType?: string;
  configJson?: string;
  ConfigJson?: string;
  styleJson?: string;
  StyleJson?: string;
  datasetId?: string;
  DatasetId?: string;
  projectId?: string;
  ProjectId?: string;
  createdAt?: string;
  CreatedAt?: string;
  updatedAt?: string;
  UpdatedAt?: string;
};

export type CreateChartData = {
  name: string;
  chartType: string;
  configJson: string;
  styleJson: string;
  datasetId: string;
  projectId: string;
};

export type UpdateChartData = Omit<CreateChartData, "projectId"> & {
  projectId?: string;
};

function normalizeChart(input: ApiChart): ChartRecord {
  const now = new Date().toISOString();

  return {
    id: String(input.id ?? input.Id ?? ""),
    name: String(input.name ?? input.Name ?? "Untitled chart"),
    chartType: String(input.chartType ?? input.ChartType ?? "bar"),
    configJson: String(input.configJson ?? input.ConfigJson ?? "{}"),
    styleJson: String(input.styleJson ?? input.StyleJson ?? "{}"),
    datasetId: String(input.datasetId ?? input.DatasetId ?? ""),
    projectId: String(input.projectId ?? input.ProjectId ?? ""),
    createdAt: String(input.createdAt ?? input.CreatedAt ?? now),
    updatedAt: String(input.updatedAt ?? input.UpdatedAt ?? now),
  };
}

function readLocalCharts(): ChartRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_CHARTS_KEY);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((item) => typeof item === "object" && item !== null) as ChartRecord[];
  } catch {
    return [];
  }
}

function writeLocalCharts(charts: ChartRecord[]): void {
  localStorage.setItem(LOCAL_CHARTS_KEY, JSON.stringify(charts));
}

function createLocalChartId(): string {
  return `local-chart-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`;
}

function getErrorStatus(error: unknown): number | undefined {
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

function getErrorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  const maybeAxios = error as {
    code?: string;
  };

  return typeof maybeAxios.code === "string" ? maybeAxios.code : undefined;
}

function shouldUseLocalFallback(error: unknown): boolean {
  const status = getErrorStatus(error);
  if (typeof status === "number") {
    return status >= 500;
  }

  const code = getErrorCode(error);
  return code === "ERR_NETWORK"
    || code === "ECONNABORTED"
    || code === "ETIMEDOUT"
    || code === "ERR_BAD_RESPONSE"
    || code === undefined;
}

function trimRows(rows: unknown): Record<string, unknown>[] | unknown {
  if (!Array.isArray(rows)) {
    return rows;
  }

  return rows
    .filter((item) => typeof item === "object" && item !== null)
    .slice(0, LOCAL_FALLBACK_MAX_ROWS) as Record<string, unknown>[];
}

function compactConfigJson(configJson: string): string {
  try {
    const parsed = JSON.parse(configJson) as Record<string, unknown>;
    const chartState = parsed.chartState as Record<string, unknown> | undefined;
    const persistedState = parsed.persistedState as Record<string, unknown> | undefined;

    if (chartState && typeof chartState === "object") {
      chartState.filteredData = trimRows(chartState.filteredData);
      chartState.snapshotMeta = {
        ...(typeof chartState.snapshotMeta === "object" && chartState.snapshotMeta !== null
          ? chartState.snapshotMeta as Record<string, unknown>
          : {}),
        localFallbackCompacted: true,
      };
    }

    if (persistedState && typeof persistedState === "object") {
      persistedState.filteredRows = trimRows(persistedState.filteredRows);
      persistedState.allRows = trimRows(persistedState.allRows);
      persistedState.localFallbackCompacted = true;
    }

    return JSON.stringify(parsed);
  } catch {
    return configJson;
  }
}

function compactLocalChart(record: ChartRecord): ChartRecord {
  return {
    ...record,
    configJson: compactConfigJson(record.configJson),
  };
}

function persistLocalCharts(charts: ChartRecord[]): void {
  const compacted = charts.map(compactLocalChart);

  try {
    writeLocalCharts(compacted);
    return;
  } catch (error) {
    if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
      throw error;
    }
  }

  const evicting = [...compacted]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  while (evicting.length > 1) {
    evicting.pop();
    try {
      writeLocalCharts(evicting);
      return;
    } catch (error) {
      if (!(error instanceof DOMException) || error.name !== "QuotaExceededError") {
        throw error;
      }
    }
  }

  throw new Error("Unable to store chart locally. Browser storage quota has been exceeded.");
}

function upsertLocalChart(record: ChartRecord): ChartRecord {
  const all = readLocalCharts();
  const existingIndex = all.findIndex((item) => item.id === record.id);
  const compactedRecord = compactLocalChart(record);

  if (existingIndex >= 0) {
    all[existingIndex] = compactedRecord;
  } else {
    all.unshift(compactedRecord);
  }

  persistLocalCharts(all);
  return compactedRecord;
}

export async function getCharts(projectId: string): Promise<ChartRecord[]> {
  try {
    const response = await api.get<ApiChart[]>(`/charts/project/${projectId}`);
    return response.data.map(normalizeChart);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    return readLocalCharts()
      .filter((chart) => chart.projectId === projectId)
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}

export async function getChart(id: string): Promise<ChartRecord> {
  try {
    const response = await api.get<ApiChart>(`/charts/${id}`);
    return normalizeChart(response.data);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const local = readLocalCharts().find((chart) => chart.id === id);
    if (!local) {
      throw new Error("Chart not found.");
    }
    return local;
  }
}

export async function createChart(data: CreateChartData): Promise<ChartRecord> {
  try {
    const response = await api.post<ApiChart>("/charts", data);
    return normalizeChart(response.data);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const now = new Date().toISOString();
    const local: ChartRecord = {
      id: createLocalChartId(),
      name: data.name,
      chartType: data.chartType,
      configJson: data.configJson,
      styleJson: data.styleJson,
      datasetId: data.datasetId,
      projectId: data.projectId,
      createdAt: now,
      updatedAt: now,
    };

    return upsertLocalChart(local);
  }
}

export async function updateChart(id: string, data: UpdateChartData): Promise<ChartRecord> {
  try {
    const response = await api.put<ApiChart>(`/charts/${id}`, data);
    return normalizeChart(response.data);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const all = readLocalCharts();
    const index = all.findIndex((chart) => chart.id === id);
    const now = new Date().toISOString();

    const updated: ChartRecord = index >= 0
      ? {
          ...all[index],
          name: data.name,
          chartType: data.chartType,
          configJson: data.configJson,
          styleJson: data.styleJson,
          datasetId: data.datasetId,
          updatedAt: now,
        }
      : {
          id,
          name: data.name,
          chartType: data.chartType,
          configJson: data.configJson,
          styleJson: data.styleJson,
          datasetId: data.datasetId,
          projectId: data.projectId ?? "",
          createdAt: now,
          updatedAt: now,
        };

    return upsertLocalChart(updated);
  }
}

export async function deleteChart(id: string): Promise<void> {
  try {
    await api.delete(`/charts/${id}`);
  } catch (error) {
    if (!shouldUseLocalFallback(error)) {
      throw error;
    }

    const remaining = readLocalCharts().filter((chart) => chart.id !== id);
    persistLocalCharts(remaining);
  }
}

const chartService = {
  getCharts,
  getChart,
  createChart,
  updateChart,
  deleteChart,
};

export default chartService;