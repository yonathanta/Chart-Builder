import * as d3 from "d3";
import type { ChartSpec } from "../specs/chartSpec";
import type { DataRecord } from "../data/providers/DataProvider";

export type BarOrientation = "vertical" | "horizontal";
export type BarMode = "grouped" | "stacked" | "percent";

export type BarRenderOptions = {
  orientation?: BarOrientation;
  mode?: BarMode;
  showAxes?: boolean;
  showLabels?: boolean;
  transitionMs?: number;
};

export type RenderResult = {
  width: number;
  height: number;
};

const DEFAULT_MARGIN = { top: 24, right: 16, bottom: 48, left: 64 };
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 480;

/**
 * Render a bar chart into a provided SVG element using pre-fetched data and a validated ChartSpec.
 *
 * Purpose:
 * - Framework-agnostic rendering hook: consumes a spec + data and draws with D3, keeping all fetch/state outside.
 * - Supports orientation (vertical/horizontal) and layout modes (grouped, stacked, 100% stacked) with animated transitions.
 * - Respects spec-driven layout, palette, and animation settings while remaining independent from Vue components.
 *
 * Inputs:
 * - svg: Target SVG root element to draw into. Caller owns its lifecycle; this function clears existing children.
 * - spec: Validated ChartSpec (encoding/category/value/series, layout size/margins, style palette, animation flags).
 * - data: Array of records already loaded by a DataProvider. No fetching occurs here.
 * - options: Overrides for orientation/mode/axes/labels/transitionMs; spec.animation still applies to motion toggles.
 *
 * Outputs:
 * - Returns the final width/height used (after applying layout and margins). Mutates the provided SVG DOM in-place.
 *
 * Assumptions:
 * - spec.encoding.category/value exist; series is optional. Data is numeric for value and stringifiable for category/series.
 * - Caller ensures data is clean and consistent; this renderer does not sanitize or aggregate.
 * - SVG has no fixed viewBox; sizes come from spec.layout (fallback defaults are applied here).
 *
 * Maintenance notes:
 * - Keep data-fetching and spec validation outside; this should remain a pure render step.
 * - If adding new modes or encodings, update scale domains, stack logic, and label formatting together.
 * - Respect prefers-reduced-motion and spec.animation when altering transitions. Avoid introducing side effects beyond the svg node.
 */
export function renderBarChart(
  svg: SVGSVGElement,
  spec: ChartSpec,
  data: DataRecord[],
  options: BarRenderOptions = {}
): RenderResult {
  const orientation: BarOrientation = options.orientation ?? "vertical";
  const mode: BarMode = options.mode ?? "grouped";
  const showAxes = options.showAxes ?? true;
  const showLabels = options.showLabels ?? false;
  const animation = spec.animation;
  const prefersReduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const enableTransitions = animation?.enabled !== false && !prefersReduced;
  const transitionMs = animation?.durationMs ?? options.transitionMs ?? 600;
  const stagger = animation?.stagger ?? false;
  const easingMap: Record<string, (normalizedTime: number) => number> = {
    ease: d3.easeCubic,
    "ease-in": d3.easeCubicIn,
    "ease-out": d3.easeCubicOut,
    "ease-in-out": d3.easeCubicInOut,
    linear: d3.easeLinear,
  };
  const easeFn = easingMap[animation?.easing ?? "ease-out"] ?? d3.easeCubicOut;

  const margin = { ...DEFAULT_MARGIN, ...(spec.layout?.padding ?? {}) };
  const width = spec.layout?.width ?? DEFAULT_WIDTH;
  const height = spec.layout?.height ?? DEFAULT_HEIGHT;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const categoryField = spec.encoding.category.field;
  const valueField = spec.encoding.value.field;
  const seriesField = spec.encoding.series?.field;

  const seriesKeys = seriesField
    ? Array.from(new Set(data.map((d) => String(d[seriesField] ?? ""))).values())
    : ["__single__"];

  // Prepare data in a consistent shape.
  const rows = data.map((d) => ({
    category: d[categoryField] as string,
    value: Number(d[valueField]),
    series: seriesField ? String(d[seriesField]) : "__single__",
  }));

  const categories = Array.from(new Set(rows.map((d) => d.category)).values());

  // Clear and set up SVG root.
  const root = d3.select(svg);
  root.selectAll("*").remove();
  root.attr("width", width).attr("height", height);

  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

  const color = d3
    .scaleOrdinal<string>()
    .domain(seriesKeys)
    .range(spec.style?.palette ?? d3.schemeTableau10);

  const xBand = d3.scaleBand<string>().domain(categories).padding(0.2);
  const yLinear = d3.scaleLinear();

  // Orientation-aware scale assignment.
  if (orientation === "vertical") {
    xBand.range([0, innerWidth]);
    yLinear.range([innerHeight, 0]);
  } else {
    xBand.range([0, innerHeight]);
    yLinear.range([0, innerWidth]);
  }

  const seriesGroupScale = d3
    .scaleBand<string>()
    .domain(seriesKeys)
    .padding(0.1)
    .range([0, xBand.bandwidth()]);

  // Stacking setup
  const stackGen = d3
    .stack<{ category: string;[key: string]: number }>()
    .keys(seriesKeys);
  if (mode === "percent") {
    stackGen.offset(d3.stackOffsetExpand);
  }

  const groupedNested = d3.group(rows, (d) => d.category);
  const stackedData = stackGen(
    categories.map((c) => {
      const entry: Record<string, number> = { category: c };
      seriesKeys.forEach((k) => {
        const rec = groupedNested.get(c)?.find((r) => r.series === k);
        entry[k] = rec ? rec.value : 0;
      });
      return entry;
    }) as any
  );

  // Domains
  if (mode === "grouped") {
    const maxVal = d3.max(rows, (d) => d.value) ?? 0;
    yLinear.domain([0, maxVal * 1.05]);
  } else {
    const maxVal = d3.max(stackedData, (layer) => d3.max(layer, (s) => s[1])) ?? 0;
    const domainMax = mode === "percent" ? 1 : maxVal;
    yLinear.domain([0, domainMax * 1.05]);
  }

  const axisBottom = orientation === "vertical" ? d3.axisBottom(xBand) : d3.axisLeft(xBand);
  const axisLeft = orientation === "vertical" ? d3.axisLeft(yLinear) : d3.axisBottom(yLinear);

  // Bars selection
  if (mode === "grouped") {
    const groups = g
      .selectAll("g.bar-group")
      .data(categories, (d: any) => d as string);

    const groupsEnter = groups
      .enter()
      .append("g")
      .attr("class", "bar-group")
      .attr("transform", (d) =>
        orientation === "vertical"
          ? `translate(${xBand(d)},0)`
          : `translate(0,${xBand(d)})`
      );

    const mergedGroups = groupsEnter.merge(groups as any);

    const bars = mergedGroups
      .selectAll<SVGRectElement, any>("rect.bar")
      .data(
        (category) => rows.filter((r) => r.category === category),
        (d: any) => `${d.category}-${d.series}`
      );

    const barsEnter = bars
      .enter()
      .append("rect")
      .attr("class", "bar")
      .attr("fill", (d) => color(d.series))
      .attr("x", (d) => (orientation === "vertical" ? (seriesGroupScale(d.series) ?? 0) : 0))
      .attr("y", () => (orientation === "vertical" ? yLinear(0) : (seriesGroupScale(d.series) ?? 0)))
      .attr("width", orientation === "vertical" ? Math.max(0, Number(seriesGroupScale.bandwidth() ?? 0)) : 0)
      .attr("height", orientation === "vertical" ? 0 : Math.max(0, Number(seriesGroupScale.bandwidth() ?? 0)));

    const barsMerged = barsEnter.merge(bars as any);

    const applyBarAttrs = (sel: d3.Selection<SVGRectElement, any, any, any>) =>
      sel
        .attr("x", (d) => (orientation === "vertical" ? (seriesGroupScale(d.series) ?? 0) : 0))
        .attr("y", (d) => (orientation === "vertical" ? Number(yLinear(Number(d.value))) : (seriesGroupScale(d.series) ?? 0)))
        .attr("width", (d) => {
          if (orientation === "vertical") return Math.max(0, Number(seriesGroupScale.bandwidth() ?? 0));
          return Math.max(0, Number(yLinear(Number(d.value))));
        })
        .attr("height", (d) =>
          orientation === "vertical"
            ? Math.max(0, Number(innerHeight - yLinear(Number(d.value))))
            : Math.max(0, Number(seriesGroupScale.bandwidth() ?? 0))
        );

    if (enableTransitions) {
      applyBarAttrs(
        barsMerged
          .transition()
          .duration(transitionMs)
          .ease(easeFn)
          .delay((_, i) => (stagger ? i * 40 : 0))
      );
      bars
        .exit()
        .transition()
        .duration(transitionMs / 2)
        .attr("height", 0)
        .remove();
    } else {
      applyBarAttrs(barsMerged);
      bars.exit().remove();
    }
  } else {
    // stacked or percent
    const stackedSeries = g
      .selectAll<SVGGElement, d3.SeriesPoint<any>[]>("g.stacked")
      .data(stackedData, (d: any) => d.key as string);

    const stackedEnter = stackedSeries.enter().append("g").attr("class", "stacked");
    stackedEnter.merge(stackedSeries as any).attr("fill", (d) => color(d.key as string));

    const rects = stackedEnter
      .merge(stackedSeries as any)
      .selectAll<SVGRectElement, d3.SeriesPoint<any>>("rect")
      .data((d) => d, (d: any) => `${d.data.category}-${(d as any).series ?? d[2] ?? d[0]}`);

    const rectsEnter = rects
      .enter()
      .append("rect")
      .attr("x", () => (orientation === "vertical" ? Math.max(0, Number(xBand.bandwidth() ?? 0) / 2) : 0))
      .attr("y", () => (orientation === "vertical" ? yLinear(0) : Math.max(0, Number(xBand.bandwidth() ?? 0) / 2)))
      .attr("width", () => (orientation === "vertical" ? Math.max(0, Number(xBand.bandwidth() ?? 0)) : 0))
      .attr("height", () => (orientation === "vertical" ? 0 : Math.max(0, Number(xBand.bandwidth() ?? 0))));

    const rectsMerged = rectsEnter.merge(rects as any);

    const applyStackedAttrs = (sel: d3.Selection<SVGRectElement, d3.SeriesPoint<any>, any, any>) =>
      sel
        .attr("x", (d) =>
          orientation === "vertical"
            ? (xBand(d.data.category) ?? 0)
            : Number(yLinear(Number(d[0])))
        )
        .attr("y", (d) =>
          orientation === "vertical"
            ? Number(yLinear(Number(d[1])))
            : (xBand(d.data.category) ?? 0)
        )
        .attr("width", (d) =>
          orientation === "vertical"
            ? Math.max(0, Number(xBand.bandwidth() ?? 0))
            : Math.max(0, Number(yLinear(Number(d[1])) - yLinear(Number(d[0]))))
        )
        .attr("height", (d) =>
          orientation === "vertical"
            ? Math.max(0, Number(yLinear(Number(d[0])) - yLinear(Number(d[1]))))
            : Math.max(0, Number(xBand.bandwidth() ?? 0))
        );

    if (enableTransitions) {
      applyStackedAttrs(
        rectsMerged
          .transition()
          .duration(transitionMs)
          .ease(easeFn)
          .delay((_, i) => (stagger ? i * 40 : 0))
      );
      rects
        .exit()
        .transition()
        .duration(transitionMs / 2)
        .attr("height", 0)
        .remove();
    } else {
      applyStackedAttrs(rectsMerged);
      rects.exit().remove();
    }
  }

  if (showAxes) {
    if (orientation === "vertical") {
      g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(axisBottom);
      g.append("g").call(axisLeft);
    } else {
      g.append("g").call(axisBottom);
      g
        .append("g")
        .attr("transform", `translate(${innerWidth},0)`)
        .call(axisLeft);
    }
  }

  if (showLabels) {
    const labelSelection = g
      .selectAll<SVGTextElement, any>("text.bar-label")
      .data(rows, (d: any) => `${d.category}-${d.series}`);

    const labelsEnter = labelSelection
      .enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("font-size", 12)
      .attr("fill", "#111");

    const labelsMerged = labelsEnter.merge(labelSelection as any);

    const applyLabelAttrs = (sel: d3.Selection<SVGTextElement, any, any, any>) =>
      sel
        .text((d) => d3.format(mode === "percent" ? ".0%" : ".2s")(d.value))
        .attr("x", (d) => {
          if (orientation === "vertical") {
            return (xBand(d.category) ?? 0) + (seriesGroupScale(d.series) ?? 0) + seriesGroupScale.bandwidth() / 2;
          }
          return yLinear(d.value) + 6;
        })
        .attr("y", (d) => {
          if (orientation === "vertical") {
            return yLinear(d.value) - 4;
          }
          return (xBand(d.category) ?? 0) + (seriesGroupScale(d.series) ?? 0) + seriesGroupScale.bandwidth() / 2 + 4;
        })
        .attr("text-anchor", orientation === "vertical" ? "middle" : "start");

    if (enableTransitions) {
      applyLabelAttrs(
        labelsMerged
          .transition()
          .duration(transitionMs)
          .ease(easeFn)
          .delay((_, i) => (stagger ? i * 40 : 0))
      );
      labelSelection.exit().remove();
    } else {
      applyLabelAttrs(labelsMerged);
      labelSelection.exit().remove();
    }
  }

  return { width, height };
}
