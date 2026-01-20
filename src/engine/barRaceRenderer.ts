/**
 * D3 bar chart race renderer (SVG-first).
 * Animates bars over time using a temporal dimension; callers supply pre-fetched frame data.
 * Uses key-based joins for object constancy between frames.
 */
import * as d3 from "d3";
import type { ChartSpec } from "../specs/chartSpec";
import type { DataRecord } from "../data/providers/DataProvider";

export type BarRaceFrame = {
  time: string | number;
  data: DataRecord[];
};

export type BarRaceOptions = {
  durationMs?: number; // per frame
  maxBars?: number;
  easing?: (normalizedTime: number) => number;
};

export type BarRaceController = {
  start(): void;
  stop(): void;
};

const DEFAULT_MARGIN = { top: 40, right: 24, bottom: 40, left: 120 };
const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 540;

export function renderBarRace(
  svg: SVGSVGElement,
  spec: ChartSpec,
  frames: BarRaceFrame[],
  options: BarRaceOptions = {}
): BarRaceController {
  const duration = options.durationMs ?? 1200;
  const easing = options.easing ?? d3.easeCubicOut;
  const maxBars = options.maxBars ?? 12;

  const margin = { ...DEFAULT_MARGIN, ...(spec.layout?.margin ?? {}) };
  const width = spec.layout?.width ?? DEFAULT_WIDTH;
  const height = spec.layout?.height ?? DEFAULT_HEIGHT;
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const categoryField = spec.encoding.category.field;
  const valueField = spec.encoding.value.field;
  const palette = spec.style?.palette ?? d3.schemeTableau10;

  const root = d3.select(svg);
  root.selectAll("*").remove();
  root.attr("width", width).attr("height", height);

  const g = root.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
  const barGroup = g.append("g").attr("class", "bars");
  const labelGroup = g.append("g").attr("class", "labels");
  const axisGroup = g.append("g").attr("class", "axis")
    .attr("transform", `translate(0,${innerHeight})`);
  const title = g.append("text")
    .attr("class", "frame-title")
    .attr("x", innerWidth)
    .attr("y", -12)
    .attr("text-anchor", "end")
    .attr("font-size", 14)
    .attr("fill", "#334155");

  const color = d3.scaleOrdinal<string>().range(palette);

  let timer: d3.Timer | null = null;
  let frameIndex = 0;

  function update(frame: BarRaceFrame) {
    const sorted = frame.data
      .map((d) => ({ key: String(d[categoryField]), value: Number(d[valueField]) }))
      .filter((d) => Number.isFinite(d.value))
      .sort((a, b) => d3.descending(a.value, b.value))
      .slice(0, maxBars);

    const x = d3.scaleLinear()
      .domain([0, d3.max(sorted, (d) => d.value)! * 1.05])
      .range([0, innerWidth]);

    const y = d3.scaleBand<string>()
      .domain(sorted.map((d) => d.key).reverse())
      .range([innerHeight, 0])
      .padding(0.15);

    const bars = barGroup.selectAll<SVGRectElement, typeof sorted[number]>("rect.bar")
      .data(sorted, (d: any) => d.key);

    bars.enter()
      .append("rect")
      .attr("class", "bar")
      .attr("fill", (d) => color(d.key))
      .attr("x", 0)
      .attr("y", (d) => y(d.key) ?? 0)
      .attr("width", 0)
      .attr("height", y.bandwidth())
      .merge(bars)
      .transition()
      .duration(duration)
      .ease(easing)
      .attr("y", (d) => y(d.key) ?? 0)
      .attr("width", (d) => x(d.value))
      .attr("height", y.bandwidth());

    bars.exit()
      .transition()
      .duration(duration / 2)
      .attr("width", 0)
      .remove();

    const labels = labelGroup.selectAll<SVGTextElement, typeof sorted[number]>("text.bar-label")
      .data(sorted, (d: any) => d.key);

    labels.enter()
      .append("text")
      .attr("class", "bar-label")
      .attr("x", 4)
      .attr("y", (d) => (y(d.key) ?? 0) + y.bandwidth() / 2)
      .attr("dy", "0.35em")
      .attr("font-size", 12)
      .attr("fill", "#0f172a")
      .text((d) => `${d.key}`)
      .merge(labels)
      .transition()
      .duration(duration)
      .ease(easing)
      .attr("x", (d) => x(d.value) + 6)
      .attr("y", (d) => (y(d.key) ?? 0) + y.bandwidth() / 2)
      .text((d) => `${d.key} ${d3.format(".2s")(d.value)}`);

    labels.exit().remove();

    const axis = d3.axisBottom(x).ticks(5).tickFormat(d3.format(".2s") as any);
    axisGroup.transition().duration(duration).ease(easing).call(axis as any);

    title.text(String(frame.time));
  }

  function start() {
    if (!frames.length) return;
    frameIndex = 0;
    update(frames[frameIndex]);
    if (timer) timer.stop();
    timer = d3.interval(() => {
      frameIndex = (frameIndex + 1) % frames.length;
      update(frames[frameIndex]);
    }, duration);
  }

  function stop() {
    if (timer) timer.stop();
    timer = null;
  }

  return { start, stop };
}
