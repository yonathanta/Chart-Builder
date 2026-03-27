import type { ChartType, Layout } from "../specs/chartSpec";

export type DatasetColumnType = "numeric" | "category" | "time";
export type DatasetShape = "trend" | "comparison" | "multi-series" | "correlation";

export type DatasetColumnMetadata = {
  name: string;
  type: DatasetColumnType;
  nonEmptyCount: number;
  distinctCount: number;
  uniqueRatio: number;
  sampleValues: string[];
};

export type ChartRecommendationPreview =
  | { kind: "line" | "area"; values: number[] }
  | { kind: "bar"; values: number[] }
  | { kind: "groupedBar"; groups: number[][] }
  | { kind: "pie"; segments: number[] }
  | { kind: "scatter"; points: Array<{ x: number; y: number; r?: number }> };

export type RecommendationTransform = {
  kind: "wide-to-long";
  categoryField: string;
  valueField: string;
  seriesField: string;
  valueFields: string[];
};

export type ChartRecommendation = {
  id: string;
  title: string;
  type: ChartType;
  confidence: number;
  reason: string;
  shape: DatasetShape;
  encoding: {
    category?: string;
    value?: string;
    series?: string;
    x?: string;
    y?: string;
    size?: string;
  };
  layoutPreset?: Layout["preset"];
  styleMode?: "simple" | "grouped" | "stacked" | "percent";
  axisHints?: {
    xType?: "time" | "linear" | "category";
  };
  transform?: RecommendationTransform;
  preview: ChartRecommendationPreview;
};

export type DatasetAnalysis = {
  columns: DatasetColumnMetadata[];
  shapes: DatasetShape[];
  rowCount: number;
  primaryFields: {
    time?: string;
    category?: string;
    series?: string;
    numeric?: string;
    numericFields: string[];
  };
  signature: string;
};

export type MaterializedRecommendation = {
  rows: Record<string, unknown>[];
  encoding: ChartRecommendation["encoding"];
};

const RECOMMENDATION_LOG_KEY = "chartBuilder:recommendation-log:v1";

function normalizeString(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  return String(value).trim();
}

function isLikelyNumericValue(value: unknown): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }

  if (/^\d{4}$/.test(normalized) && Number(normalized) >= 1800 && Number(normalized) <= 2200) {
    return false;
  }

  return Number.isFinite(Number(normalized));
}

function isLikelyTimeValue(value: unknown): boolean {
  if (value instanceof Date) {
    return !Number.isNaN(value.getTime());
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value >= 1800 && value <= 2200;
  }

  const normalized = normalizeString(value);
  if (!normalized) {
    return false;
  }

  if (/^\d{4}$/.test(normalized)) {
    const year = Number(normalized);
    return year >= 1800 && year <= 2200;
  }

  if (/^\d{4}[-/]\d{1,2}([-/]\d{1,2})?$/.test(normalized)) {
    return true;
  }

  if (/^[A-Za-z]{3,9}\s+\d{4}$/.test(normalized)) {
    return true;
  }

  return !Number.isNaN(Date.parse(normalized));
}

function normalizePointValues(values: number[], maxItems: number): number[] {
  const sliced = values.slice(0, maxItems);
  if (sliced.length === 0) {
    return [];
  }

  const min = Math.min(...sliced);
  const max = Math.max(...sliced);
  const span = max - min || 1;

  return sliced.map((value) => (value - min) / span);
}

function normalizeScatterPoints(points: Array<{ x: number; y: number; r?: number }>, maxItems: number) {
  const sliced = points.slice(0, maxItems);
  if (sliced.length === 0) {
    return [];
  }

  const xMin = Math.min(...sliced.map((point) => point.x));
  const xMax = Math.max(...sliced.map((point) => point.x));
  const yMin = Math.min(...sliced.map((point) => point.y));
  const yMax = Math.max(...sliced.map((point) => point.y));
  const rMax = Math.max(...sliced.map((point) => point.r ?? 0), 1);
  const xSpan = xMax - xMin || 1;
  const ySpan = yMax - yMin || 1;

  return sliced.map((point) => ({
    x: (point.x - xMin) / xSpan,
    y: (point.y - yMin) / ySpan,
    r: point.r ? Math.max(0.2, point.r / rMax) : undefined,
  }));
}

export function detectColumnType(columnName: string, values: unknown[]): DatasetColumnType {
  const normalizedValues = values.map((value) => normalizeString(value)).filter((value) => value.length > 0);
  if (normalizedValues.length === 0) {
    return "category";
  }

  const numericRate = normalizedValues.filter((value) => isLikelyNumericValue(value)).length / normalizedValues.length;
  const timeRate = normalizedValues.filter((value) => isLikelyTimeValue(value)).length / normalizedValues.length;
  const isIdentifierLike = /(id|code|postal|zip|phone)/i.test(columnName);
  const isTimeNamed = /(date|time|year|month|day)/i.test(columnName);

  if ((isTimeNamed && (timeRate >= 0.6 || numericRate >= 0.85)) || timeRate >= 0.75) {
    return "time";
  }

  if (!isIdentifierLike && numericRate >= 0.85) {
    return "numeric";
  }

  return "category";
}

function choosePrimaryCategory(columns: DatasetColumnMetadata[], rowCount: number): string | undefined {
  const candidates = columns.filter((column) => column.type === "category");
  if (candidates.length === 0) {
    return undefined;
  }

  return candidates
    .slice()
    .sort((left, right) => {
      const targetDistinct = Math.min(8, Math.max(3, Math.round(rowCount * 0.2)));
      const leftDistance = Math.abs(left.distinctCount - targetDistinct);
      const rightDistance = Math.abs(right.distinctCount - targetDistinct);
      if (leftDistance !== rightDistance) {
        return leftDistance - rightDistance;
      }

      return right.nonEmptyCount - left.nonEmptyCount;
    })[0]?.name;
}

function chooseSeriesField(columns: DatasetColumnMetadata[], primaryCategory?: string): string | undefined {
  return columns
    .filter((column) => column.type === "category" && column.name !== primaryCategory)
    .find((column) => column.distinctCount >= 2 && column.distinctCount <= 12)?.name;
}

function inferTrendXAxisType(rows: Record<string, unknown>[], fieldName?: string): "time" | "linear" | "category" | undefined {
  if (!fieldName) {
    return undefined;
  }

  const samples = rows.map((row) => normalizeString(row[fieldName])).filter((value) => value.length > 0).slice(0, 24);
  if (samples.length === 0) {
    return undefined;
  }

  if (samples.every((value) => /^\d{4}$/.test(value))) {
    return "linear";
  }

  if (samples.every((value) => isLikelyTimeValue(value))) {
    return "time";
  }

  return "category";
}

export function analyzeDataset(data: Record<string, unknown>[]): DatasetAnalysis {
  const rows = Array.isArray(data) ? data.filter((row) => row && typeof row === "object") : [];
  const columnNames = Array.from(rows.reduce((set, row) => {
    Object.keys(row).forEach((key) => set.add(key));
    return set;
  }, new Set<string>()));

  const columns = columnNames.map((name) => {
    const values = rows.map((row) => row[name]);
    const nonEmpty = values.map((value) => normalizeString(value)).filter((value) => value.length > 0);
    const distinct = new Set(nonEmpty);

    return {
      name,
      type: detectColumnType(name, values),
      nonEmptyCount: nonEmpty.length,
      distinctCount: distinct.size,
      uniqueRatio: nonEmpty.length > 0 ? distinct.size / nonEmpty.length : 0,
      sampleValues: Array.from(distinct).slice(0, 4),
    } satisfies DatasetColumnMetadata;
  });

  const timeField = columns.find((column) => column.type === "time")?.name;
  const categoryField = choosePrimaryCategory(columns, rows.length);
  const numericFields = columns.filter((column) => column.type === "numeric").map((column) => column.name);
  const primaryNumeric = numericFields[0];
  const seriesField = chooseSeriesField(columns, categoryField);

  const shapes: DatasetShape[] = [];
  if (timeField && numericFields.length > 0) {
    shapes.push("trend");
  }
  if (categoryField && numericFields.length > 0) {
    shapes.push("comparison");
  }
  if (numericFields.length > 1 || Boolean(seriesField)) {
    shapes.push("multi-series");
  }
  if (numericFields.length >= 2) {
    shapes.push("correlation");
  }

  return {
    columns,
    shapes,
    rowCount: rows.length,
    primaryFields: {
      time: timeField,
      category: categoryField,
      series: seriesField,
      numeric: primaryNumeric,
      numericFields,
    },
    signature: JSON.stringify({
      rowCount: rows.length,
      columns: columns.map((column) => ({ name: column.name, type: column.type })),
    }),
  };
}

export function materializeRecommendationRows(
  rows: Record<string, unknown>[],
  recommendation: Pick<ChartRecommendation, "transform" | "encoding">,
): MaterializedRecommendation {
  if (!recommendation.transform || recommendation.transform.kind !== "wide-to-long") {
    return { rows, encoding: recommendation.encoding };
  }

  const { categoryField, valueField, seriesField, valueFields } = recommendation.transform;
  const materializedRows = rows.flatMap((row) => valueFields
    .map((fieldName) => {
      const numericValue = Number(row[fieldName]);
      if (!Number.isFinite(numericValue)) {
        return null;
      }

      return {
        ...row,
        [categoryField]: row[categoryField],
        [valueField]: numericValue,
        [seriesField]: fieldName,
      };
    })
    .filter((item): item is Record<string, unknown> => item !== null));

  return {
    rows: materializedRows,
    encoding: {
      ...recommendation.encoding,
      category: categoryField,
      value: valueField,
      series: seriesField,
    },
  };
}

function buildPreview(rows: Record<string, unknown>[], recommendation: Omit<ChartRecommendation, "preview">): ChartRecommendationPreview {
  const materialized = materializeRecommendationRows(rows, recommendation);

  if (recommendation.type === "line") {
    const yField = recommendation.encoding.value ?? recommendation.encoding.y;
    const values = materialized.rows.map((row) => Number(row[yField ?? ""])).filter((value) => Number.isFinite(value));
    return { kind: "line", values: normalizePointValues(values, 7) };
  }

  if (recommendation.type === "area") {
    const yField = recommendation.encoding.value ?? recommendation.encoding.y;
    const values = materialized.rows.map((row) => Number(row[yField ?? ""])).filter((value) => Number.isFinite(value));
    return { kind: "area", values: normalizePointValues(values, 7) };
  }

  if (recommendation.type === "pie") {
    const valueField = recommendation.encoding.value;
    const values = materialized.rows
      .map((row) => Number(row[valueField ?? ""]))
      .filter((value) => Number.isFinite(value) && value > 0);
    const total = values.reduce((sum, value) => sum + value, 0) || 1;
    return { kind: "pie", segments: values.slice(0, 5).map((value) => value / total) };
  }

  if (recommendation.type === "scatter") {
    const xField = recommendation.encoding.x ?? recommendation.encoding.category;
    const yField = recommendation.encoding.y ?? recommendation.encoding.value;
    const sizeField = recommendation.encoding.size;
    const points = materialized.rows
      .map((row) => ({ x: Number(row[xField ?? ""]), y: Number(row[yField ?? ""]), r: sizeField ? Number(row[sizeField]) : undefined }))
      .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
    return { kind: "scatter", points: normalizeScatterPoints(points, 12) };
  }

  if (recommendation.styleMode === "grouped") {
    const categoryField = recommendation.encoding.category;
    const valueField = recommendation.encoding.value;
    const grouped = new Map<string, number[]>();

    for (const row of materialized.rows.slice(0, 24)) {
      const category = normalizeString(row[categoryField ?? ""]);
      const value = Number(row[valueField ?? ""]);
      if (!category || !Number.isFinite(value)) {
        continue;
      }

      const bucket = grouped.get(category) ?? [];
      bucket.push(value);
      grouped.set(category, bucket);
    }

    return {
      kind: "groupedBar",
      groups: Array.from(grouped.values()).slice(0, 4).map((values) => normalizePointValues(values, 3)),
    };
  }

  const valueField = recommendation.encoding.value;
  const values = materialized.rows.map((row) => Number(row[valueField ?? ""])).filter((value) => Number.isFinite(value));
  return { kind: "bar", values: normalizePointValues(values, 6) };
}

export function suggestCharts(metadata: DatasetAnalysis, rows: Record<string, unknown>[] = []): ChartRecommendation[] {
  const recommendations: Array<Omit<ChartRecommendation, "preview">> = [];
  const pushRecommendation = (recommendation: Omit<ChartRecommendation, "preview">) => {
    const existingIndex = recommendations.findIndex((candidate) => candidate.id === recommendation.id);
    if (existingIndex >= 0) {
      if (recommendation.confidence > recommendations[existingIndex].confidence) {
        recommendations[existingIndex] = recommendation;
      }
      return;
    }
    recommendations.push(recommendation);
  };

  const timeField = metadata.primaryFields.time;
  const categoryField = metadata.primaryFields.category;
  const seriesField = metadata.primaryFields.series;
  const primaryNumeric = metadata.primaryFields.numeric;
  const numericFields = metadata.primaryFields.numericFields;
  const categoryColumn = metadata.columns.find((column) => column.name === categoryField);
  const trendXAxisType = inferTrendXAxisType(rows, timeField);

  if (timeField && numericFields.length > 1) {
    pushRecommendation({
      id: "line-multi-wide",
      title: "Multi-line Chart",
      type: "line",
      confidence: 0.97,
      reason: `Detected a time field (${timeField}) with multiple numeric measures.`,
      shape: "multi-series",
      encoding: { category: timeField, value: "value", series: "metric" },
      axisHints: { xType: trendXAxisType },
      transform: { kind: "wide-to-long", categoryField: timeField, valueField: "value", seriesField: "metric", valueFields: numericFields.slice(0, 6) },
    });

    pushRecommendation({
      id: "bar-grouped-wide",
      title: "Grouped Bar Chart",
      type: "bar",
      confidence: 0.84,
      reason: `Multiple numeric measures can be compared side by side by ${timeField}.`,
      shape: "multi-series",
      encoding: { category: timeField, value: "value", series: "metric" },
      styleMode: "grouped",
      transform: { kind: "wide-to-long", categoryField: timeField, valueField: "value", seriesField: "metric", valueFields: numericFields.slice(0, 6) },
    });
  }

  if (timeField && primaryNumeric) {
    pushRecommendation({
      id: "line-trend",
      title: "Line Chart",
      type: "line",
      confidence: numericFields.length > 1 ? 0.91 : 0.96,
      reason: `Detected a time field (${timeField}) and numeric measure (${primaryNumeric}).`,
      shape: "trend",
      encoding: { category: timeField, value: primaryNumeric, ...(seriesField ? { series: seriesField } : {}) },
      axisHints: { xType: trendXAxisType },
    });

    pushRecommendation({
      id: "area-trend",
      title: "Area Chart",
      type: "area",
      confidence: 0.79,
      reason: "Time-based values also fit cumulative trend exploration.",
      shape: "trend",
      encoding: { category: timeField, value: primaryNumeric, ...(seriesField ? { series: seriesField } : {}) },
      axisHints: { xType: trendXAxisType },
    });
  }

  if (categoryField && numericFields.length > 1) {
    pushRecommendation({
      id: "bar-grouped-category-wide",
      title: "Grouped Bar Chart",
      type: "bar",
      confidence: 0.95,
      reason: `Detected one category field (${categoryField}) and multiple numeric measures.`,
      shape: "multi-series",
      encoding: { category: categoryField, value: "value", series: "metric" },
      styleMode: "grouped",
      transform: { kind: "wide-to-long", categoryField, valueField: "value", seriesField: "metric", valueFields: numericFields.slice(0, 6) },
    });

    pushRecommendation({
      id: "stacked-bar-category-wide",
      title: "Stacked Bar Chart",
      type: "stackedBar",
      confidence: 0.86,
      reason: `Stacking highlights part-to-whole contributions across ${categoryField}.`,
      shape: "multi-series",
      encoding: { category: categoryField, value: "value", series: "metric" },
      styleMode: "stacked",
      transform: { kind: "wide-to-long", categoryField, valueField: "value", seriesField: "metric", valueFields: numericFields.slice(0, 6) },
    });
  } else if (categoryField && primaryNumeric) {
    pushRecommendation({
      id: "bar-comparison",
      title: "Bar Chart",
      type: "bar",
      confidence: 0.93,
      reason: `Detected a category field (${categoryField}) and numeric measure (${primaryNumeric}).`,
      shape: "comparison",
      encoding: { category: categoryField, value: primaryNumeric, ...(seriesField ? { series: seriesField } : {}) },
      styleMode: seriesField ? "grouped" : "simple",
    });

    if ((categoryColumn?.distinctCount ?? 99) <= 8) {
      pushRecommendation({
        id: "pie-composition",
        title: "Pie Chart",
        type: "pie",
        confidence: 0.72,
        reason: "Low-cardinality categories make part-to-whole splits easy to read.",
        shape: "comparison",
        encoding: { category: categoryField, value: primaryNumeric },
      });
    }
  }

  if (numericFields.length >= 2) {
    pushRecommendation({
      id: "scatter-correlation",
      title: "Scatter Plot",
      type: "scatter",
      confidence: 0.9,
      reason: "Detected at least two numeric fields for relationship analysis.",
      shape: "correlation",
      encoding: {
        category: numericFields[0],
        value: numericFields[1],
        x: numericFields[0],
        y: numericFields[1],
        ...(seriesField ? { series: seriesField } : {}),
      },
    });
  }

  if (categoryField && primaryNumeric) {
    pushRecommendation({
      id: "bubble-ranked",
      title: "Bubble Chart",
      type: "bubble",
      confidence: 0.62,
      reason: "Ranked category magnitudes can also be presented as bubbles.",
      shape: "comparison",
      encoding: { category: categoryField, value: primaryNumeric },
    });
  }

  if (recommendations.length === 0) {
    const fallbackCategory = metadata.columns[0]?.name;
    const fallbackValue = metadata.columns[1]?.name ?? metadata.columns[0]?.name;
    pushRecommendation({
      id: "bar-fallback",
      title: "Bar Chart",
      type: "bar",
      confidence: 0.55,
      reason: "Fallback recommendation based on the first available columns.",
      shape: "comparison",
      encoding: { category: fallbackCategory, value: fallbackValue },
    });
  }

  return recommendations.sort((left, right) => right.confidence - left.confidence).map((recommendation) => ({
    ...recommendation,
    preview: buildPreview(rows, recommendation),
  }));
}

export function logRecommendationSelection(metadata: DatasetAnalysis | null, recommendation: ChartRecommendation): void {
  if (typeof localStorage === "undefined") {
    return;
  }

  try {
    const raw = localStorage.getItem(RECOMMENDATION_LOG_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    const current = Array.isArray(parsed) ? parsed : [];
    current.push({
      datasetSignature: metadata?.signature ?? "unknown",
      recommendationId: recommendation.id,
      chartType: recommendation.type,
      confidence: recommendation.confidence,
      selectedAt: new Date().toISOString(),
    });
    localStorage.setItem(RECOMMENDATION_LOG_KEY, JSON.stringify(current.slice(-200)));
  } catch {
    // Ignore recommendation log failures.
  }
}