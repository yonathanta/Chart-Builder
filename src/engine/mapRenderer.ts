/**
 * Map rendering (choropleth + point) using D3 v7.
 * Framework-agnostic: consumes validated ChartSpec + prepared GeoJSON and data records.
 * No fetching; caller supplies data and geometry.
 */
import * as d3 from "d3";
import type { ChartSpec } from "../specs/chartSpec";
import type { DataRecord } from "../data/providers/DataProvider";

export type MapRenderMode = "choropleth" | "points";

export type MapRenderOptions = {
  mode?: MapRenderMode;
  valueField?: string; // override spec.encoding.value.field when needed
  categoryField?: string; // override spec.encoding.category.field used to join to GeoJSON feature id/property
  pointLatField?: string;
  pointLonField?: string;
  colorRange?: string[];
  showGraticule?: boolean;
  projection?: d3.GeoProjection; // external projection if the caller needs specific CRS
  projectionType?: "mercator" | "naturalEarth" | "equalEarth";
  legend?: {
    show?: boolean;
    title?: string;
    tickFormat?: (n: number) => string;
  };
};

export type GeoFeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry>;

const DEFAULT_MARGIN = { top: 16, right: 16, bottom: 16, left: 16 };
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 520;

/**
 * Render a map into the provided SVG using GeoJSON + data records.
 * - Choropleth: joins data by categoryField to feature id/property and fills polygons by value.
 * - Points: plots point data using lon/lat fields.
 */
export function renderMap(
  svg: SVGSVGElement,
  spec: ChartSpec,
  geo: GeoFeatureCollection,
  data: DataRecord[],
  options: MapRenderOptions = {}
): { width: number; height: number } {
  const mode: MapRenderMode = options.mode ?? "choropleth";
  const categoryField = options.categoryField ?? spec.encoding.category.field;
  const valueField = options.valueField ?? spec.encoding.value?.field ?? "value";
  const latField = options.pointLatField ?? "lat";
  const lonField = options.pointLonField ?? "lon";

  const margin = { ...DEFAULT_MARGIN, ...(spec.layout?.margin ?? {}) };
  const width = spec.layout?.width ?? DEFAULT_WIDTH;
  const height = spec.layout?.height ?? DEFAULT_HEIGHT;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const palette = options.colorRange ?? spec.style?.palette ?? d3.schemeBlues[7];

  // Clear SVG and scaffold group
  const root = d3.select(svg);
  root.selectAll("*").remove();
  root.attr("width", width).attr("height", height);
  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const projection = buildProjection(options.projection, options.projectionType, geo, innerWidth, innerHeight);
  const path = d3.geoPath(projection);

  if (options.showGraticule) {
    const graticule = d3.geoGraticule();
    g.append("path")
      .datum(graticule())
      .attr("class", "graticule")
      .attr("d", path as any)
      .attr("fill", "none")
      .attr("stroke", "#e2e8f0")
      .attr("stroke-width", 0.5);
  }

  if (mode === "choropleth") {
    const dataByKey = new Map<string, number>();
    data.forEach((d) => {
      const k = String(d[categoryField]);
      const v = Number(d[valueField]);
      if (!Number.isFinite(v)) return;
      dataByKey.set(k, v);
    });

    const values = Array.from(dataByKey.values());
    const [min, max] = (d3.extent(values) as [number, number]) ?? [0, 1];
    const color = d3
      .scaleQuantize<number>()
      .domain([min ?? 0, max ?? 1])
      .range(palette);

    g.selectAll<SVGPathElement, GeoJSON.Feature<GeoJSON.Geometry>>("path.feature")
      .data(geo.features)
      .join("path")
      .attr("class", "feature")
      .attr("d", path as any)
      .attr("fill", (d) => {
        const key = featureKey(d, categoryField);
        const v = key ? dataByKey.get(key) : undefined;
        return v != null ? color(v) : "#e5e7eb";
      })
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 0.5)
      .append("title")
      .text((d) => {
        const key = featureKey(d, categoryField);
        const v = key ? dataByKey.get(key) : undefined;
        return `${key ?? ""}${v != null ? `: ${v}` : ""}`;
      });

    if (options.legend?.show !== false) {
      drawQuantizedLegend(g, color, palette, options.legend?.title ?? spec.title ?? "", options.legend?.tickFormat);
    }
  } else {
    const coords: Array<{ x: number; y: number; value?: number; label?: string }> = [];
    data.forEach((d) => {
      const lon = Number(d[lonField]);
      const lat = Number(d[latField]);
      if (!Number.isFinite(lon) || !Number.isFinite(lat)) return;
      const [x, y] = projection([lon, lat]) ?? [];
      if (x == null || y == null) return;
      coords.push({ x, y, value: valueField ? Number(d[valueField]) : undefined, label: String(d[categoryField] ?? "") });
    });

    const radius = d3.scaleSqrt()
      .domain(d3.extent(coords, (d) => d.value ?? 1) as [number, number])
      .range([2, 14]);

    g.append("g")
      .selectAll("circle.point")
      .data(coords)
      .join("circle")
      .attr("class", "point")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => radius(d.value ?? 1))
      .attr("fill", palette[0] ?? "#0ea5e9")
      .attr("fill-opacity", 0.75)
      .attr("stroke", "#fff")
      .attr("stroke-width", 1)
      .append("title")
      .text((d) => `${d.label ?? ""}${d.value != null ? `: ${d.value}` : ""}`);
  }

  return { width, height };
}

function featureKey(feature: GeoJSON.Feature<GeoJSON.Geometry>, field: string): string | undefined {
  if (feature.id != null) return String(feature.id);
  const props = feature.properties as Record<string, unknown> | null | undefined;
  if (props && field in props) return String(props[field] as any);
  return undefined;
}

function buildProjection(
  projection: d3.GeoProjection | undefined,
  projectionType: MapRenderOptions["projectionType"] | undefined,
  geo: GeoFeatureCollection,
  width: number,
  height: number
): d3.GeoProjection {
  if (projection) return projection.fitSize([width, height], geo as any);
  let base: d3.GeoProjection;
  switch (projectionType) {
    case "equalEarth":
      base = d3.geoEqualEarth();
      break;
    case "naturalEarth":
      base = d3.geoNaturalEarth1();
      break;
    case "mercator":
    default:
      base = d3.geoMercator();
  }
  return base.fitSize([width, height], geo as any);
}

function drawQuantizedLegend(
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  scale: d3.ScaleQuantize<number, string>,
  palette: string[],
  title: string,
  tickFormat?: (n: number) => string
) {
  const legendHeight = 10;
  const legendGap = 6;
  const legendWidth = 180;
  const domain = scale.domain();
  const steps = palette.length;
  const stepWidth = legendWidth / steps;

  const legend = g
    .append("g")
    .attr("class", "legend")
    .attr("transform", "translate(8,8)");

  legend
    .append("text")
    .attr("x", 0)
    .attr("y", -4)
    .attr("font-size", 12)
    .attr("fill", "#0f172a")
    .text(title);

  const swatches = legend
    .append("g")
    .attr("transform", `translate(0, ${legendGap})`)
    .selectAll("rect")
    .data(palette)
    .join("rect")
    .attr("x", (_, i) => i * stepWidth)
    .attr("y", 0)
    .attr("width", stepWidth)
    .attr("height", legendHeight)
    .attr("fill", (d) => d)
    .attr("stroke", "#e2e8f0");

  const axisScale = d3.scaleLinear().domain(domain).range([0, legendWidth]);
  const axis = d3.axisBottom(axisScale).ticks(steps).tickFormat((d) => (tickFormat ? tickFormat(Number(d)) : String(d)));

  legend
    .append("g")
    .attr("transform", `translate(0, ${legendHeight + legendGap})`)
    .call(axis as any)
    .call((gAxis) => gAxis.selectAll("text").attr("font-size", 11).attr("fill", "#475569"))
    .call((gAxis) => gAxis.selectAll("line").attr("stroke", "#cbd5e1"));
}
