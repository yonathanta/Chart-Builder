import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export type BuilderBarConfig = {
  cornerRadius?: number;
  barPadding?: number;
  barColor?: string;
  animationDuration?: number;
  staggerDelay?: number;
  showGridlines?: boolean;
  showValues?: boolean;
  xLabelOffset?: number;
  xLabelRotation?: number;
  yLabelOffset?: number;
  labelAlignment?: 'left' | 'right';
  separateLabelLine?: boolean;
  valueAlignment?: 'left' | 'right';
  numberFormat?: string; // d3-format string, e.g. ',.2~f'
  swapLabelsAndValues?: boolean;
  replaceCodesWithFlags?: boolean;
  valueMin?: number;
  valueMax?: number;
  customizeColors?: boolean;
  // Gradient coloring across min/max values
  useGradientColors?: boolean;
  gradientLowColor?: string;
  gradientHighColor?: string;
  // Value-based coloring
  useValueColors?: boolean;
  lowThreshold?: number;
  highThreshold?: number;
  lowColor?: string;
  midColor?: string;
  highColor?: string;
  separatingLines?: boolean;
  barBackground?: boolean;
  thickerBars?: boolean;
  sortBars?: boolean;
  reverseOrder?: boolean;
  groupBarsByColumn?: boolean;
  labelPosition?: 'left' | 'right' | 'top' | 'bottom' | 'inside';
  labelRotate?: number;
  labelDistance?: number;
  labelFontSize?: number;
  labelFontWeight?: 'normal' | 'bold';
  labelFontColor?: string;
  overlays?: BarOverlay[];
};

export type BarOverlay = {
  id: string;
  name: string;
  type: 'value' | 'range';
  column: string;
  rangeMinColumn?: string;
  rangeMaxColumn?: string;
  labelMode: 'first' | 'legend' | 'hidden';
  labelText?: string;
  color: string;
  opacity: number;
  visible: boolean;
};

export type BarOverride = {
  color?: string;
  label?: string;
};

/**
 * PURPOSE:
 * Renders a bar chart using D3.js based on a ChartSpec configuration.
 * Supports vertical, horizontal, grouped, stacked, and 100% stacked bars.
 *
 * DESIGN PRINCIPLES:
 * - Stateless renderer (no data fetching)
 * - Spec-driven behavior
 * - SVG-first, export-agnostic
 * - Maintainable and extensible
 *
 * @param svgEl - Target SVG element
 * @param spec - Chart specification object
 * @param data - Normalized dataset
 * @param config - Builder-style overrides for padding, corners, animation, and gridlines
 */
export function renderBarChart(
  svgEl: SVGSVGElement,
  spec: ChartSpec,
  data: Record<string, unknown>[],
  config: BuilderBarConfig = {},
  overrides?: Record<string, BarOverride>,
  selectedBarId?: string,
  onSelect?: (barId: string) => void
) {
  // Defaults keep backward compatibility while enabling "Builder" overrides.
  const cfg: Required<BuilderBarConfig> = {
    cornerRadius: config.cornerRadius ?? 0,
    barPadding: config.barPadding ?? 0.2,
    barColor: config.barColor ?? '#4F81BD',
    animationDuration: config.animationDuration ?? 800,
    staggerDelay: config.staggerDelay ?? 20,
    showGridlines: config.showGridlines ?? true,
    showValues: config.showValues ?? true,
    xLabelOffset: config.xLabelOffset ?? 0,
    xLabelRotation: config.xLabelRotation ?? 0,
    yLabelOffset: config.yLabelOffset ?? 0,
    labelAlignment: config.labelAlignment ?? 'left',
    separateLabelLine: config.separateLabelLine ?? false,
    valueAlignment: config.valueAlignment ?? 'right',
    numberFormat: config.numberFormat ?? ',.2~f',
    swapLabelsAndValues: config.swapLabelsAndValues ?? false,
    replaceCodesWithFlags: config.replaceCodesWithFlags ?? false,
    valueMin: (config.valueMin ?? undefined) as unknown as number,
    valueMax: (config.valueMax ?? undefined) as unknown as number,
    customizeColors: config.customizeColors ?? false,
    useGradientColors: config.useGradientColors ?? false,
    gradientLowColor: config.gradientLowColor ?? '#a7f3d0',
    gradientHighColor: config.gradientHighColor ?? '#065f46',
    useValueColors: config.useValueColors ?? false,
    lowThreshold: config.lowThreshold ?? 10,
    highThreshold: config.highThreshold ?? 90,
    lowColor: config.lowColor ?? '#a7f3d0',
    midColor: config.midColor ?? '#34d399',
    highColor: config.highColor ?? '#065f46',
    separatingLines: config.separatingLines ?? false,
    barBackground: config.barBackground ?? false,
    thickerBars: config.thickerBars ?? false,
    sortBars: config.sortBars ?? false,
    reverseOrder: config.reverseOrder ?? false,
    groupBarsByColumn: config.groupBarsByColumn ?? false,
    labelPosition: config.labelPosition ?? 'top',
    labelRotate: config.labelRotate ?? 0,
    labelDistance: config.labelDistance ?? 5,
    labelFontSize: config.labelFontSize ?? 12,
    labelFontWeight: config.labelFontWeight ?? 'normal',
    labelFontColor: config.labelFontColor ?? '#333333',
    overlays: config.overlays ?? [],
  };

  /* ============================
     1. BASIC SETUP (persistent layers)
     ============================ */

  // Clear any previous drawing in the preview so the selected chart renders alone
  try { d3.select(svgEl).selectAll('*').remove(); } catch (e) { /* ignore */ }

  const svg = d3.select(svgEl);

  const width = Number(svg.attr('width')) || 800;
  const height = Number(svg.attr('height')) || 450;

  /* ============================
     2. CONFIG EXTRACTION & DATA PREPARATION
     ============================ */

  const style = (spec as any).style || {};
  const layoutPreset = spec.layout?.preset;
  const orientation = style.orientation || (layoutPreset === 'horizontal' ? 'horizontal' : 'vertical'); // vertical | horizontal
  let mode = style.mode || (spec.encoding.series ? 'grouped' : 'simple'); // simple | grouped | stacked | stacked100
  const animation = style.animation ?? true;
  const easingFn = d3.easeBackOut; // specified easing for growth animations

  const categoryKey = spec.encoding.category.field;
  const valueKey = spec.encoding.value.field;
  const seriesKey = spec.encoding.series?.field;

  if (cfg.groupBarsByColumn && seriesKey) {
    mode = 'grouped';
  }

  let categories = [...new Set(data.map(d => d[categoryKey]))];
  const series = seriesKey
    ? [...new Set(data.map(d => d[seriesKey as string]))]
    : [];

  if (cfg.sortBars) {
    const roll = d3.rollup(
      data,
      vals => d3.sum(vals, v => Number(v[valueKey]) || 0),
      d => d[categoryKey]
    );
    categories = [...categories].sort((a, b) => (roll.get(b) ?? 0) - (roll.get(a) ?? 0));
  }
  if (cfg.reverseOrder) {
    categories = [...categories].reverse();
  }

  // Dynamically calculate margin.left for horizontal charts to prevent label cropping
  let dynamicMarginLeft = 70;
  if (orientation === 'horizontal') {
    const tempText = svg.append('text')
      .style('visibility', 'hidden')
      .style('font-size', `${cfg.labelFontSize}px`)
      .style('font-weight', cfg.labelFontWeight);

    let maxLabelWidth = 0;
    categories.forEach(cat => {
      tempText.text(String(cat));
      const bbox = (tempText.node() as SVGTextElement).getBBox();
      if (bbox.width > maxLabelWidth) maxLabelWidth = bbox.width;
    });
    tempText.remove();
    dynamicMarginLeft = Math.max(70, maxLabelWidth + 20); // Maintain at least 70px, add 20px padding
  }

  // Dynamically calculate margin.right to prevent value labels from cropping
  let dynamicMarginRight = 30;
  if (cfg.showValues) {
    const tempText = svg.append('text')
      .style('visibility', 'hidden')
      .style('font-size', `${cfg.labelFontSize}px`)
      .style('font-weight', cfg.labelFontWeight);

    let maxValueWidth = 0;
    const fmt = d3.format(cfg.numberFormat);
    const getBarId = (d: any) => (seriesKey ? `${d[categoryKey]}-${d[seriesKey]}` : `${d[categoryKey]}`);

    data.forEach(d => {
      const v = Number(d[valueKey]);
      const text = Number.isFinite(v) ? fmt(v) : String(d[valueKey] ?? '');
      const labelText = overrides?.[getBarId(d)]?.label ?? text;
      tempText.text(labelText);
      const bbox = (tempText.node() as SVGTextElement).getBBox();
      if (bbox.width > maxValueWidth) maxValueWidth = bbox.width;
    });
    tempText.remove();

    if (orientation === 'horizontal') {
      dynamicMarginRight = Math.max(30, maxValueWidth + 20); // Add padding for horizontal labels at the end of bars
    } else if (cfg.labelPosition === 'right') {
      dynamicMarginRight = Math.max(30, maxValueWidth + 20); // Add padding if labels are placed to the right of vertical bars
    }
  }

  const margin = { top: 60, right: dynamicMarginRight, bottom: 60, left: dynamicMarginLeft };
  const innerWidth = width - margin.left - margin.right;
  const innerHeight = height - margin.top - margin.bottom;

  const root = svg
    .attr('width', width)
    .attr('height', height)
    .selectAll<SVGGElement, unknown>('g.chart-root')
    .data([null])
    .join('g')
    .attr('class', 'chart-root')
    .attr('transform', `translate(${margin.left},${margin.top})`);

  // Track orientation to avoid animating grid/axes across flips (causes shear).
  const previousOrientation = (root.attr('data-orientation') as string) || '';
  const orientationChanged = previousOrientation !== orientation;
  root.attr('data-orientation', orientation);

  const gridLayer = root
    .selectAll<SVGGElement, unknown>('g.gridlines')
    .data([null])
    .join('g')
    .attr('class', 'gridlines');

  const barBackgroundLayer = root
    .selectAll<SVGGElement, unknown>('g.bar-background')
    .data([null])
    .join('g')
    .attr('class', 'bar-background');

  const barsLayer = root
    .selectAll<SVGGElement, unknown>('g.bars')
    .data([null])
    .join('g')
    .attr('class', 'bars');

  const labelsLayer = root
    .selectAll<SVGGElement, unknown>('g.labels')
    .data([null])
    .join('g')
    .attr('class', 'labels');

  const xAxisLayer = root
    .selectAll<SVGGElement, unknown>('g.x-axis')
    .data([null])
    .join('g')
    .attr('class', 'x-axis');

  const yAxisLayer = root
    .selectAll<SVGGElement, unknown>('g.y-axis')
    .data([null])
    .join('g')
    .attr('class', 'y-axis');

  const overlaysLayer = root
    .selectAll<SVGGElement, unknown>('g.overlays')
    .data([null])
    .join('g')
    .attr('class', 'overlays');

  // Compact number formatter for display (labels + tooltip)
  const humanizeValue = (val: unknown) => {
    const num = Number(val);
    if (!Number.isFinite(num)) return String(val ?? '');
    const abs = Math.abs(num);
    const fmt = (n: number, suffix: string) => `${+(n.toFixed(1))}${suffix}`;
    if (abs >= 1_000_000_000) return fmt(num / 1_000_000_000, 'B');
    if (abs >= 1_000_000) return fmt(num / 1_000_000, 'M');
    if (abs >= 1_000) return fmt(num / 1_000, 'K');
    return `${num}`;
  };

  // Tooltip element for hover; remove any existing tooltip to avoid duplicates
  const parentNode = (svgEl.parentElement || svgEl) as HTMLElement;
  const existing = parentNode.querySelector('.chart-tooltip') as HTMLElement | null;
  if (existing) existing.remove();
  let tooltipEl: HTMLDivElement | null = null;
  tooltipEl = document.createElement('div');
  tooltipEl.className = 'chart-tooltip';
  tooltipEl.style.position = 'absolute';
  tooltipEl.style.pointerEvents = 'none';
  tooltipEl.style.background = 'rgba(17,24,39,0.9)';
  tooltipEl.style.color = '#fff';
  tooltipEl.style.padding = '6px 8px';
  tooltipEl.style.borderRadius = '6px';
  tooltipEl.style.fontSize = '12px';
  tooltipEl.style.transform = 'translate(-50%, -120%)';
  tooltipEl.style.opacity = '0';
  tooltipEl.style.transition = 'opacity 120ms ease';
  parentNode.appendChild(tooltipEl);

  // Small multiples: facet by series if available; fallback to single render when no series.
  if (layoutPreset === 'smallMultiples' && seriesKey && series.length > 0) {
    renderSmallMultiples();
    return;
  }

  /* ============================
     4. SCALES
     ============================ */

  // Use band for categories and linear for values; swap axes per orientation.
  const barPadding = cfg.thickerBars ? Math.max(cfg.barPadding - 0.05, 0) : cfg.barPadding;

  const categoryBand = d3
    .scaleBand<string>()
    .domain(categories)
    .range(orientation === 'vertical' ? [0, innerWidth] : [0, innerHeight])
    .paddingInner(barPadding)
    .paddingOuter(barPadding / 2);

  const seriesBand = d3
    .scaleBand<string>()
    .domain(series)
    .range([0, categoryBand.bandwidth()])
    .padding(0.05);

  const valueLinear = d3
    .scaleLinear()
    .range(orientation === 'vertical' ? [innerHeight, 0] : [0, innerWidth]);

  /* ============================
     5. STACK LOGIC (IF NEEDED)
     ============================ */

  let stackedData: any = null;

  if ((mode === 'stacked' || mode === 'stacked100') && seriesKey) {
    const stack = d3.stack()
      .keys(series)
      .value((d: any, key) =>
        d.values.find((v: any) => v[seriesKey] === key)?.[valueKey] || 0
      );

    if (mode === 'stacked100') {
      stack.offset(d3.stackOffsetExpand);
    } else {
      stack.offset(d3.stackOffsetDiverging);
    }

    const grouped = d3.group(data, d => d[categoryKey]);

    stackedData = stack(
      Array.from(grouped, ([key, values]) => ({
        category: key,
        values
      }))
    );

    const maxValue = mode === 'stacked100' ? 1 : d3.max(stackedData, (s: any) => d3.max(s, (d: any) => d[1])) || 0;
    const minValue = mode === 'stacked100' ? 0 : d3.min(stackedData, (s: any) => d3.min(s, (d: any) => d[0])) || 0;

    const domMin = cfg.valueMin ?? Math.min(0, Number(minValue));
    const domMax = cfg.valueMax ?? Math.max(0, Number(maxValue));
    valueLinear.domain([domMin, domMax]);
  } else {
    const values = data.map(d => Number(d[valueKey]));
    const computedMax = d3.max(values) ?? 0;
    const computedMin = d3.min(values) ?? 0;
    // Ensure domain includes 0 for bars to grow from baseline
    const domMin = cfg.valueMin ?? Math.min(0, computedMin as number);
    const domMax = cfg.valueMax ?? Math.max(0, computedMax as number);
    valueLinear.domain([domMin, domMax]);
  }

  /* ============================
     6. AXES + GRIDLINES
     ============================ */

  const xAxis = orientation === 'vertical'
    ? d3.axisBottom(categoryBand)
    : d3.axisBottom(valueLinear);

  const yAxis = orientation === 'vertical'
    ? d3.axisLeft(valueLinear)
    : d3.axisLeft(categoryBand);

  // Ensure no lingering transitions on axis groups before redrawing.
  xAxisLayer.interrupt();
  yAxisLayer.interrupt();

  if (orientation === 'vertical') {
    xAxisLayer.attr('transform', `translate(0,${innerHeight})`).call(xAxis);
    yAxisLayer.attr('transform', `translate(0,0)`).call(yAxis);
  } else {
    xAxisLayer.attr('transform', `translate(0,${innerHeight})`).call(xAxis);
    yAxisLayer.attr('transform', `translate(0,0)`).call(yAxis);

    // Align category labels near the bars for horizontal layouts.
    yAxisLayer.selectAll('.tick text')
      .attr('text-anchor', cfg.labelAlignment === 'left' ? 'end' : 'start')
      .attr('dy', cfg.separateLabelLine ? '1.6em' : '0.32em')
      .attr('x', cfg.labelAlignment === 'left' ? -6 : 6);
  }

  // Optional flag replacement for category codes
  if (cfg.replaceCodesWithFlags) {
    const toFlag = (code: string) => {
      const c = code.trim().toUpperCase();
      if (c.length !== 2) return code;
      const base = 127397; // regional indicator base
      const chars = [c.charCodeAt(0) + base, c.charCodeAt(1) + base];
      return String.fromCodePoint(...chars);
    };
    const tickTextSel = orientation === 'vertical' ? xAxisLayer.selectAll('.tick text') : yAxisLayer.selectAll('.tick text');
    tickTextSel.text((d: any) => toFlag(String(d)) as any);
  }

  // Gridlines join; fade instead of remove to respect toggle changes.
  const grid = gridLayer
    .selectAll<SVGGElement, unknown>('g.grid')
    .data([null])
    .join('g')
    .attr('class', 'grid');

  const gridTransform = `translate(0,0)`;

  // Avoid animating gridlines when flipping orientation to prevent shearing.
  grid.interrupt();
  grid.attr('transform', gridTransform);

  // Draw straight gridlines using value ticks to avoid skew in horizontal mode.
  const gridTicks = valueLinear.ticks(6);
  const gridLines = grid
    .selectAll<SVGLineElement, number>('line.value-grid')
    .data(gridTicks)
    .join('line')
    .attr('class', 'value-grid')
    .attr('stroke', '#cbd5e1')
    .attr('stroke-width', 1);

  gridLines
    .attr('x1', t => orientation === 'vertical' ? 0 : valueLinear(t))
    .attr('x2', t => orientation === 'vertical' ? innerWidth : valueLinear(t))
    .attr('y1', t => orientation === 'vertical' ? valueLinear(t) : innerHeight)
    .attr('y2', t => orientation === 'vertical' ? valueLinear(t) : 0);

  if (animation && !orientationChanged) {
    gridLines
      .transition()
      .duration(cfg.animationDuration)
      .style('opacity', cfg.showGridlines ? 1 : 0.05);
  } else {
    gridLines.style('opacity', cfg.showGridlines ? 1 : 0.05);
  }

  barBackgroundLayer
    .selectAll<SVGRectElement, unknown>('rect.bg')
    .data([null])
    .join('rect')
    .attr('class', 'bg')
    .attr('width', innerWidth)
    .attr('height', innerHeight)
    .attr('fill', '#f8fafc')
    .style('opacity', cfg.barBackground ? 1 : 0);

  /* ============================
     7. BARS + INTERACTIONS
     ============================ */

  const gradientScale = cfg.useGradientColors
    ? d3.scaleLinear<string>()
      .domain(valueLinear.domain() as [number, number])
      .range([cfg.gradientLowColor, cfg.gradientHighColor])
      .clamp(true)
    : null;

  const palette = (style.palette as string[] | undefined) || undefined;
  const colorScale = cfg.customizeColors && palette?.length
    ? d3.scaleOrdinal<string, string>().domain(categories.map(String)).range(palette)
    : null;

  const colorDarken = (base: string) => {
    const c = d3.color(base);
    if (!c) return base;
    return c.darker(0.8).formatHex();
  };

  const keyFn = (d: any) => `${d[categoryKey]}|${seriesKey ? d[seriesKey] : ''}`;

  const barId = (d: any) => (seriesKey ? `${d[categoryKey]}-${d[seriesKey]}` : `${d[categoryKey]}`);

  const resolveColor = (d: any) => {
    const override = overrides?.[barId(d)]?.color;
    if (override) return override;
    if (gradientScale) {
      const v = Number(d[valueKey]);
      if (Number.isFinite(v)) return gradientScale(v);
    }
    // Value-based coloring takes precedence when enabled
    if (cfg.useValueColors) {
      const v = Number(d[valueKey]);
      if (Number.isFinite(v)) {
        if (v < (cfg.lowThreshold ?? 0)) return cfg.lowColor || cfg.barColor;
        if (v > (cfg.highThreshold ?? 0)) return cfg.highColor || cfg.barColor;
        return cfg.midColor || cfg.barColor;
      }
    }
    // Otherwise use category palette when available
    if (colorScale) return colorScale(String(d[categoryKey]));
    return cfg.barColor;
  };

  const barX = (d: any) =>
    orientation === 'vertical'
      ? (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(d[seriesKey]) ?? 0 : 0)
      : ((): number => {
        const v = Number(d[valueKey]);
        const baseline = valueLinear(0);
        const xValue = valueLinear(Number.isFinite(v) ? v : 0);
        return Math.min(baseline, xValue);
      })();

  const barY = (d: any) =>
    orientation === 'vertical'
      ? ((): number => {
        const v = Number(d[valueKey]);
        const baseline = valueLinear(0);
        const yValue = valueLinear(Number.isFinite(v) ? v : 0);
        return Math.min(baseline, yValue);
      })()
      : (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(d[seriesKey]) ?? 0 : 0);

  const barWidth = (d: any) =>
    orientation === 'vertical'
      ? mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth()
      : ((): number => {
        const v = Number(d[valueKey]);
        const baseline = valueLinear(0);
        const xValue = valueLinear(Number.isFinite(v) ? v : 0);
        return Math.abs(xValue - baseline);
      })();

  const barHeight = (d: any) =>
    orientation === 'vertical'
      ? ((): number => {
        const v = Number(d[valueKey]);
        const baseline = valueLinear(0);
        const yValue = valueLinear(Number.isFinite(v) ? v : 0);
        return Math.abs(yValue - baseline);
      })()
      : mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth();

  const bars = barsLayer
    .selectAll<SVGRectElement, any>('rect.bar')
    .data(mode === 'simple' || mode === 'grouped' ? data : [], keyFn)
    .join(
      enter => {
        const rects = enter
          .append('rect')
          .attr('class', 'bar')
          .attr('fill', d => resolveColor(d))
          .attr('rx', cfg.cornerRadius);

        if (orientation === 'vertical') {
          rects
            .attr('x', d => barX(d))
            .attr('width', d => barWidth(d))
            .attr('y', valueLinear(0))
            .attr('height', 0);
        } else {
          rects
            .attr('y', d => barY(d))
            .attr('height', d => barHeight(d))
            .attr('x', valueLinear(0))
            .attr('width', 0);
        }

        return rects;
      },
      update => update,
      exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
    );

  const transitionBase = d3.transition().duration(animation ? cfg.animationDuration : 0).ease(easingFn);

  bars
    .transition(transitionBase)
    .delay((_, i) => i * cfg.staggerDelay)
    .attr('fill', d => resolveColor(d))
    .attr('rx', cfg.cornerRadius)
    .attr('stroke', cfg.separatingLines ? '#e2e8f0' : 'none')
    .attr('stroke-width', cfg.separatingLines ? 1 : 0)
    .attr('x', d => barX(d))
    .attr('y', d => barY(d))
    .attr('width', d => barWidth(d))
    .attr('height', d => barHeight(d));

  // Hover interactions: darken on hover, return on leave.
  bars
    .attr('data-id', d => barId(d))
    .attr('stroke', d => (barId(d) === selectedBarId ? '#0f172a' : 'none'))
    .attr('stroke-width', d => (barId(d) === selectedBarId ? 2 : 0))
    .on('click', function (event, d) {
      if (onSelect) onSelect(barId(d));
    })
    .on('mouseover', function (event, d) {
      const base = resolveColor(d);
      d3.select(this)
        .transition()
        .duration(cfg.animationDuration / 2)
        .attr('fill', colorDarken(base));
      if (tooltipEl) {
        const val = d[valueKey];
        const seriesVal = seriesKey ? d[seriesKey] : undefined;
        const content = `${seriesVal !== undefined ? `<div><strong>${String(seriesVal)}</strong></div>` : ''}<div>Value: ${fmt(val)}</div>`;
        const rect = (svgEl.parentElement || svgEl).getBoundingClientRect();
        tooltipEl.style.left = `${event.clientX - rect.left}px`;
        tooltipEl.style.top = `${event.clientY - rect.top}px`;
        tooltipEl.innerHTML = content;
        tooltipEl.style.opacity = '1';
      }
    })
    .on('mousemove', function (event) {
      if (!tooltipEl) return;
      const rect = (svgEl.parentElement || svgEl).getBoundingClientRect();
      tooltipEl.style.left = `${event.clientX - rect.left}px`;
      tooltipEl.style.top = `${event.clientY - rect.top}px`;
    })
    .on('mouseout', function (_, d) {
      d3.select(this)
        .transition()
        .duration(cfg.animationDuration / 2)
        .attr('fill', resolveColor(d));
      if (tooltipEl) tooltipEl.style.opacity = '0';
    });

  /* ============================
     STACKED RENDERING
     ============================ */

  if (mode === 'stacked' || mode === 'stacked100') {
    const seriesGroups = barsLayer
      .selectAll<SVGGElement, any>('g.series')
      .data(stackedData || [], (d: any) => d.key)
      .join('g')
      .attr('class', 'series')
      .attr('fill', (d: any) => {
        // Find color for the series
        if (colorScale) return colorScale(String(d.key));
        return cfg.barColor;
      });

    const stackBars = seriesGroups
      .selectAll<SVGRectElement, any>('rect.bar')
      .data((d: any) => d.map((p: any) => ({ ...p, key: d.key })), (d: any) => d.data.category)
      .join(
        enter => enter.append('rect')
          .attr('class', 'bar')
          .attr('rx', cfg.cornerRadius)
          .attr('x', (d: any) => orientation === 'vertical' ? (categoryBand(d.data.category) ?? 0) : valueLinear(0))
          .attr('y', (d: any) => orientation === 'vertical' ? valueLinear(0) : (categoryBand(d.data.category) ?? 0))
          .attr('width', (d: any) => orientation === 'vertical' ? categoryBand.bandwidth() : 0)
          .attr('height', (d: any) => orientation === 'vertical' ? 0 : categoryBand.bandwidth()),
        update => update,
        exit => exit.remove()
      );

    stackBars
      .transition(transitionBase)
      .delay((_, i) => i * cfg.staggerDelay)
      .attr('x', (d: any) => orientation === 'vertical' ? (categoryBand(d.data.category) ?? 0) : Math.min(valueLinear(d[0]), valueLinear(d[1])))
      .attr('y', (d: any) => orientation === 'vertical' ? Math.min(valueLinear(d[0]), valueLinear(d[1])) : (categoryBand(d.data.category) ?? 0))
      .attr('width', (d: any) => orientation === 'vertical' ? categoryBand.bandwidth() : Math.abs(valueLinear(d[1]) - valueLinear(d[0])))
      .attr('height', (d: any) => orientation === 'vertical' ? Math.abs(valueLinear(d[1]) - valueLinear(d[0])) : categoryBand.bandwidth())
      .attr('fill', (d: any) => {
        const id = `${d.data.category}-${d.key}`;
        return overrides?.[id]?.color || null; // Return null if no override to avoid lint error
      });

    // Add interactions to stacked bars
    stackBars
      .on('mouseover', function (event, d) {
        const base = d3.select(this.parentNode as any).attr('fill');
        d3.select(this)
          .transition()
          .duration(cfg.animationDuration / 2)
          .attr('fill', colorDarken(base as string));

        if (tooltipEl) {
          const val = (d as any)[1] - (d as any)[0];
          const content = `<div><strong>${(d as any).key}</strong></div><div>Category: ${(d as any).data.category}</div><div>Value: ${fmt(val)}</div>`;
          const rect = (svgEl.parentElement || svgEl).getBoundingClientRect();
          tooltipEl.style.left = `${event.clientX - rect.left}px`;
          tooltipEl.style.top = `${event.clientY - rect.top}px`;
          tooltipEl.innerHTML = content;
          tooltipEl.style.opacity = '1';
        }
      })
      .on('mousemove', function (event) {
        if (!tooltipEl) return;
        const rect = (svgEl.parentElement || svgEl).getBoundingClientRect();
        tooltipEl.style.left = `${event.clientX - rect.left}px`;
        tooltipEl.style.top = `${event.clientY - rect.top}px`;
      })
      .on('mouseout', function () {
        d3.select(this)
          .transition()
          .duration(cfg.animationDuration / 2)
          .attr('fill', null);
        if (tooltipEl) tooltipEl.style.opacity = '0';
      });

    // Add labels for stacked bars
    if (cfg.showValues) {
      seriesGroups.selectAll<SVGTextElement, any>('text.stack-label')
        .data(d => (d as any).map((p: any) => ({ ...p, key: (d as any).key })), (d: any) => d.data.category)
        .join('text')
        .attr('class', 'stack-label')
        .attr('fill', cfg.labelFontColor)
        .style('font-size', `${cfg.labelFontSize}px`)
        .style('font-weight', cfg.labelFontWeight)
        .attr('text-anchor', 'middle')
        .style('pointer-events', 'none')
        .transition(transitionBase)
        .delay((_, i) => i * cfg.staggerDelay)
        .attr('x', d => {
          if (orientation === 'vertical') return (categoryBand(d.data.category) ?? 0) + categoryBand.bandwidth() / 2;
          return valueLinear((d[0] + d[1]) / 2);
        })
        .attr('y', d => {
          if (orientation === 'vertical') return valueLinear((d[0] + d[1]) / 2) + cfg.labelFontSize / 3;
          return (categoryBand(d.data.category) ?? 0) + categoryBand.bandwidth() / 2 + cfg.labelFontSize / 3;
        })
        .attr('transform', d => {
          const cx = orientation === 'vertical' ? (categoryBand(d.data.category) ?? 0) + categoryBand.bandwidth() / 2 : valueLinear((d[0] + d[1]) / 2);
          const cy = orientation === 'vertical' ? valueLinear((d[0] + d[1]) / 2) : (categoryBand(d.data.category) ?? 0) + categoryBand.bandwidth() / 2;
          return cfg.labelRotate ? `rotate(${cfg.labelRotate}, ${cx}, ${cy})` : null;
        })
        .text(d => {
          const val = (d as any)[1] - (d as any)[0];
          return Math.abs(val) > 0.05 ? fmt(val) : '';
        });
    } else {
      seriesGroups.selectAll('text.stack-label').remove();
    }
  } else {
    barsLayer.selectAll('g.series').remove();
  }

  // Labels per bar with override text priority (Simple/Grouped).
  const labels = labelsLayer
    .selectAll<SVGTextElement, any>('text.bar-label')
    .data(cfg.showValues && (mode === 'simple' || mode === 'grouped') ? data : [], keyFn)
    .join(
      enter => enter.append('text').attr('class', 'bar-label').attr('fill', '#0f172a'),
      update => update,
      exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
    );

  const fmt = d3.format(cfg.numberFormat);

  labels
    .transition(transitionBase)
    .delay((_, i) => i * cfg.staggerDelay)
    .text(d => {
      const num = Number(d[valueKey]);
      const text = Number.isFinite(num) ? fmt(num) : String((d as any)[valueKey] ?? '');
      return overrides?.[barId(d)]?.label ?? text;
    })
    .attr('x', d => {
      const v = Number(d[valueKey]);
      const bw = barWidth(d) as number;
      const bx = barX(d) as number;
      const dist = cfg.labelDistance;

      if (cfg.labelPosition === 'inside') {
        return bx + bw / 2;
      }

      if (orientation === 'vertical') {
        const cx = bx + bw / 2;
        if (cfg.labelPosition === 'left') return bx - dist;
        if (cfg.labelPosition === 'right') return bx + bw + dist;
        return cx;
      } else {
        // Horizontal
        const tipX = v >= 0 ? bx + bw : bx;
        if (cfg.labelPosition === 'top') return tipX + (v >= 0 ? dist : -dist);
        if (cfg.labelPosition === 'bottom') return valueLinear(0) + (v >= 0 ? -dist : dist);
        if (cfg.labelPosition === 'right') return (v >= 0 ? bx + bw : valueLinear(0)) + dist;
        if (cfg.labelPosition === 'left') return (v >= 0 ? valueLinear(0) : bx) - dist;
        // Default (relative to tip)
        const offset = v >= 0 ? dist : -dist;
        return tipX + offset;
      }
    })
    .attr('y', d => {
      const v = Number(d[valueKey]);
      const bh = barHeight(d) as number;
      const by = barY(d) as number;
      const dist = cfg.labelDistance;

      if (cfg.labelPosition === 'inside') {
        return by + bh / 2 + cfg.labelFontSize / 3;
      }

      if (orientation === 'vertical') {
        const tipY = v >= 0 ? by : by + bh;
        const centerY = by + bh / 2;
        if (cfg.labelPosition === 'left' || cfg.labelPosition === 'right') return centerY + cfg.labelFontSize / 3;
        if (cfg.labelPosition === 'top') return v >= 0 ? by - dist : by + bh + dist + cfg.labelFontSize * 0.8;
        if (cfg.labelPosition === 'bottom') return v >= 0 ? valueLinear(0) + dist + cfg.labelFontSize * 0.8 : valueLinear(0) - dist;
        // Default (relative to tip)
        const offset = v >= 0 ? dist : -(dist + cfg.labelFontSize * 0.8);
        return tipY - offset;
      } else {
        // Horizontal
        const cy = (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? (seriesBand(d[seriesKey]) ?? 0) + seriesBand.bandwidth() / 2 : categoryBand.bandwidth() / 2);
        return cy + cfg.labelFontSize / 3;
      }
    })
    .attr('text-anchor', d => {
      if (cfg.labelPosition === 'inside') return 'middle';
      if (orientation === 'vertical') {
        if (cfg.labelPosition === 'left') return 'end';
        if (cfg.labelPosition === 'right') return 'start';
        return 'middle';
      } else {
        const v = Number(d[valueKey]);
        if (cfg.labelPosition === 'top') return v >= 0 ? 'start' : 'end';
        if (cfg.labelPosition === 'bottom') return v >= 0 ? 'end' : 'start';
        if (v >= 0) {
          if (cfg.labelPosition === 'left') return 'end';
          return 'start';
        } else {
          if (cfg.labelPosition === 'right') return 'start';
          return 'end';
        }
      }
    })
    .attr('transform', d => {
      const bw = barWidth(d) as number;
      const bh = barHeight(d) as number;
      const bx = barX(d) as number;
      const by = barY(d) as number;
      let cx = 0;
      let cy = 0;

      // Calculate anchor point for rotation correctly
      if (cfg.labelPosition === 'inside') {
        cx = bx + bw / 2;
        cy = by + bh / 2;
      } else if (orientation === 'vertical') {
        cx = bx + bw / 2;
        cy = Number(d[valueKey]) >= 0 ? by : by + bh;
      } else {
        cx = Number(d[valueKey]) >= 0 ? bx + bw : bx;
        cy = (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? (seriesBand(d[seriesKey]) ?? 0) + seriesBand.bandwidth() / 2 : categoryBand.bandwidth() / 2);
      }

      return cfg.labelRotate ? `rotate(${cfg.labelRotate}, ${cx}, ${cy})` : null;
    })
    .attr('fill', cfg.labelFontColor)
    .style('font-size', `${cfg.labelFontSize}px`)
    .style('font-weight', cfg.labelFontWeight)
    .style('opacity', 1);

  /* ============================
     OVERLAYS (value/range)
     ============================ */

  const activeOverlays = (cfg.overlays || []).filter(o => o.visible);

  activeOverlays.forEach((ov) => {
    const overlayGroup = overlaysLayer
      .selectAll<SVGGElement, any>(`g.overlay-${ov.id}`)
      .data([ov])
      .join('g')
      .attr('class', `overlay overlay-${ov.id}`)
      .attr('data-id', ov.id);

    const overlayData = data
      .map(d => {
        const val = Number((d as any)[ov.column]);
        const minVal = ov.type === 'range' ? Number((d as any)[ov.rangeMinColumn ?? ov.column]) : val;
        const maxVal = ov.type === 'range' ? Number((d as any)[ov.rangeMaxColumn ?? ov.column]) : val;
        if (!Number.isFinite(minVal) && !Number.isFinite(maxVal)) return null;
        return { ...d, __ovMin: Number.isFinite(minVal) ? minVal : 0, __ovMax: Number.isFinite(maxVal) ? maxVal : 0 };
      })
      .filter(Boolean) as any[];

    const overlayBars = overlayGroup
      .selectAll<SVGRectElement, any>('rect.overlay-bar')
      .data(overlayData, keyFn)
      .join(
        enter => enter.append('rect').attr('class', 'overlay-bar'),
        update => update,
        exit => exit.remove()
      );

    const bandwidth = (orientation === 'vertical'
      ? (mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth())
      : (mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth())) * 0.6;

    overlayBars
      .transition(transitionBase)
      .attr('fill', ov.color)
      .attr('opacity', ov.opacity)
      .attr('rx', Math.min(cfg.cornerRadius, 6))
      .attr('x', d => {
        const baseX = orientation === 'vertical'
          ? (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(d[seriesKey]) ?? 0 : 0)
          : valueLinear(ov.type === 'range' ? Math.min(d.__ovMin, d.__ovMax) : 0);
        return orientation === 'vertical' ? baseX + ((mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth()) - bandwidth) / 2 : baseX;
      })
      .attr('y', d => {
        if (orientation === 'vertical') {
          const maxVal = ov.type === 'range' ? Math.max(d.__ovMin, d.__ovMax) : d.__ovMax;
          return valueLinear(maxVal);
        }
        return (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(d[seriesKey]) ?? 0 : 0);
      })
      .attr('width', d => {
        if (orientation === 'vertical') return bandwidth;
        if (ov.type === 'range') return Math.abs(valueLinear(d.__ovMax) - valueLinear(d.__ovMin));
        return valueLinear(d.__ovMax);
      })
      .attr('height', d => {
        if (orientation === 'vertical') {
          if (ov.type === 'range') {
            const minV = Math.min(d.__ovMin, d.__ovMax);
            const maxV = Math.max(d.__ovMin, d.__ovMax);
            return Math.max(0, valueLinear(minV) - valueLinear(maxV));
          }
          return Math.abs(innerHeight - valueLinear(d.__ovMax));
        }
        return bandwidth;
      });

    if (ov.labelMode !== 'hidden' && overlayData.length) {
      const first = overlayData[0];
      const labelText = ov.labelText?.trim() || ov.name || 'Overlay';
      overlayGroup
        .selectAll<SVGTextElement, any>('text.overlay-label')
        .data([first])
        .join('text')
        .attr('class', 'overlay-label')
        .attr('fill', ov.color)
        .attr('font-size', 11)
        .attr('font-weight', '600')
        .attr('x', () => orientation === 'vertical'
          ? (categoryBand(first[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(first[seriesKey]) ?? 0 : 0) + bandwidth / 2
          : (ov.type === 'range'
            ? valueLinear(Math.max(first.__ovMin, first.__ovMax)) + 6
            : valueLinear(first.__ovMax) + 6))
        .attr('y', () => orientation === 'vertical' ? valueLinear(first.__ovMax) - 6 : (categoryBand(first[categoryKey]) ?? 0) + bandwidth / 2)
        .attr('text-anchor', orientation === 'vertical' ? 'middle' : 'start')
        .text(labelText);
    } else {
      overlayGroup.selectAll('text.overlay-label').remove();
    }
  });

  const xLabelRotation = cfg.xLabelRotation ?? 0;
  const xLabelAnchor = xLabelRotation === 0 ? 'middle' : xLabelRotation > 0 ? 'start' : 'end';

  xAxisLayer
    .selectAll<SVGTextElement, unknown>('text')
    .attr('dy', `${cfg.xLabelOffset}px`)
    .attr('transform', xLabelRotation ? `rotate(${xLabelRotation})` : null)
    .style('text-anchor', xLabelAnchor);

  yAxisLayer
    .selectAll<SVGTextElement, unknown>('text')
    .attr('dy', `${cfg.yLabelOffset}px`);

  function renderSmallMultiples() {
    const facetKeys = series;
    const facetGap = 16;
    const availableHeight = innerHeight;
    const facetHeight = Math.max(100, (availableHeight - facetGap * (facetKeys.length - 1)) / facetKeys.length);

    const facets = root
      .selectAll<SVGGElement, string>('g.facet')
      .data(facetKeys, (d: any) => d)
      .join('g')
      .attr('class', 'facet')
      .attr('transform', (_d: any, i: number) => `translate(0, ${i * (facetHeight + facetGap)})`);

    facets.each(function (facetKey: any, i, nodes) {
      const facetData = data.filter(d => d[seriesKey as string] === facetKey);
      const gFacet = d3.select(nodes[i]);

      const xBandFacet = d3
        .scaleBand<string>()
        .domain(categories as any)
        .range([0, innerWidth])
        .paddingInner(cfg.barPadding)
        .paddingOuter(cfg.barPadding / 2);

      const fMin = d3.min(facetData, (d: any) => Number(d[valueKey])) ?? 0;
      const fMax = d3.max(facetData, (d: any) => Number(d[valueKey])) ?? 0;
      const yFacet = d3
        .scaleLinear()
        .range([facetHeight, 0])
        .domain([Math.min(0, fMin), Math.max(0, fMax)]);

      const xAxisFacet = d3.axisBottom(xBandFacet);
      const yAxisFacet = d3.axisLeft(yFacet).ticks(4);

      const xLayer = gFacet
        .selectAll<SVGGElement, unknown>('g.facet-x')
        .data([null])
        .join('g')
        .attr('class', 'facet-x')
        .attr('transform', `translate(0, ${facetHeight})`)
        .call(xAxisFacet);

      const yLayer = gFacet
        .selectAll<SVGGElement, unknown>('g.facet-y')
        .data([null])
        .join('g')
        .attr('class', 'facet-y')
        .call(yAxisFacet);

      const grid = gFacet
        .selectAll<SVGGElement, unknown>('g.facet-grid')
        .data([null])
        .join('g')
        .attr('class', 'facet-grid')
        .attr('transform', `translate(0,0)`);

      const gridTicks = yFacet.ticks(4);
      const gridLines = grid
        .selectAll<SVGLineElement, number>('line.value-grid')
        .data(gridTicks)
        .join('line')
        .attr('class', 'value-grid')
        .attr('stroke', '#cbd5e1')
        .attr('stroke-width', 1)
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', t => yFacet(t))
        .attr('y2', t => yFacet(t));

      gridLines
        .transition()
        .duration(animation ? cfg.animationDuration : 0)
        .style('opacity', cfg.showGridlines ? 1 : 0.05);

      const bars = gFacet
        .selectAll<SVGRectElement, any>('rect.bar')
        .data(facetData, (d: any) => `${d[categoryKey]}`)
        .join(
          enter => enter
            .append('rect')
            .attr('class', 'bar')
            .attr('data-id', (d: any) => `${d[categoryKey]}-${facetKey}`)
            .attr('fill', (d: any) => resolveColor(d))
            .attr('rx', cfg.cornerRadius)
            .attr('x', (d: any) => xBandFacet(d[categoryKey]) ?? 0)
            .attr('width', xBandFacet.bandwidth())
            .attr('y', yFacet(0))
            .attr('height', 0),
          update => update,
          exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
        );

      bars
        .transition()
        .duration(animation ? cfg.animationDuration : 0)
        .delay((_, idx) => idx * cfg.staggerDelay)
        .attr('fill', (d: any) => resolveColor(d))
        .attr('rx', cfg.cornerRadius)
        .attr('x', (d: any) => xBandFacet(d[categoryKey]) ?? 0)
        .attr('width', xBandFacet.bandwidth())
        .attr('y', (d: any) => Math.min(yFacet(0), yFacet(d[valueKey])))
        .attr('height', (d: any) => Math.abs(yFacet(d[valueKey]) - yFacet(0)));

      const labels = gFacet
        .selectAll<SVGTextElement, any>('text.bar-label')
        .data(cfg.showValues ? facetData : [], (d: any) => `${d[categoryKey]}`)
        .join(
          enter => enter.append('text').attr('class', 'bar-label').attr('fill', '#0f172a'),
          update => update,
          exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
        );

      labels
        .transition()
        .duration(animation ? cfg.animationDuration : 0)
        .delay((_, idx) => idx * cfg.staggerDelay)
        .text((d: any) => {
          const v = Number(d[valueKey]);
          const text = Number.isFinite(v) ? fmt(v) : String(d[valueKey] ?? '');
          return overrides?.[`${d[categoryKey]}-${facetKey}`]?.label ?? text;
        })
        .attr('x', (d: any) => (xBandFacet(d[categoryKey]) ?? 0) + xBandFacet.bandwidth() / 2)
        .attr('y', (d: any) => {
          const v = Number(d[valueKey]);
          const tipY = v >= 0 ? yFacet(v) : yFacet(v);
          return v >= 0 ? tipY - 6 : tipY + 6;
        })
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', (d: any) => {
          const v = Number(d[valueKey]);
          return v >= 0 ? 'alphabetic' : 'hanging';
        })
        .style('font-size', '11px')
        .style('opacity', 0.9);

      xLayer
        .selectAll<SVGTextElement, unknown>('text')
        .attr('dy', `${cfg.xLabelOffset}px`)
        .attr('transform', xLabelRotation ? `rotate(${xLabelRotation})` : null)
        .style('text-anchor', xLabelAnchor);

      yLayer
        .selectAll<SVGTextElement, unknown>('text')
        .attr('dy', `${cfg.yLabelOffset}px`);

      bars.attr('aria-label', (d: any) => {
        const custom = overrides?.[`${d[categoryKey]}-${facetKey}`]?.label;
        const value = d[valueKey];
        const cat = d[categoryKey];
        return custom ? `${cat}: ${value} (${custom})` : `${cat}: ${value}`;
      });
    });
  }

  /* ============================
     8. ACCESSIBILITY
     ============================ */

  svg
    .attr('role', 'img')
    .attr('aria-label', spec.title || 'Bar chart');
}
