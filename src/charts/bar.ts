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
    overlays: config.overlays ?? [],
  };

  /* ============================
     1. BASIC SETUP (persistent layers)
     ============================ */

  const svg = d3.select(svgEl);

  const width = Number(svg.attr('width')) || 800;
  const height = Number(svg.attr('height')) || 450;

  const margin = { top: 40, right: 30, bottom: 60, left: 70 };
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

  // Tooltip element for hover
  let tooltipEl: HTMLDivElement | null = null;
  tooltipEl = document.createElement('div');
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
  (svgEl.parentElement || svgEl).appendChild(tooltipEl);

  /* ============================
     2. CONFIG EXTRACTION
     ============================ */

  const style = (spec as any).style || {};
  const layoutPreset = spec.layout?.preset;
  const orientation = style.orientation || (layoutPreset === 'horizontal' ? 'horizontal' : 'vertical'); // vertical | horizontal
  let mode = style.mode || (spec.encoding.series ? 'grouped' : 'simple'); // simple | grouped | stacked | stacked100
  const animation = style.animation ?? true;
  const easingFn = d3.easeBackOut; // specified easing for growth animations

    // Track orientation to avoid animating grid/axes across flips (causes shear).
    const previousOrientation = (root.attr('data-orientation') as string) || '';
    const orientationChanged = previousOrientation !== orientation;
    root.attr('data-orientation', orientation);

  const categoryKey = spec.encoding.category.field;
  const valueKey = spec.encoding.value.field;
  const seriesKey = spec.encoding.series?.field;

  if (cfg.groupBarsByColumn && seriesKey) {
    mode = 'grouped';
  }

  /* ============================
     3. DATA PREPARATION
     ============================ */

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
    }

    const grouped = d3.group(data, d => d[categoryKey]);

    stackedData = stack(
      Array.from(grouped, ([key, values]) => ({
        category: key,
        values
      }))
    );

    const maxValue =
      mode === 'stacked100'
        ? 1
        : d3.max(stackedData, s => d3.max(s, d => d[1])) || 0;

    const domMin = cfg.valueMin ?? 0;
    const domMax = cfg.valueMax ?? maxValue;
    valueLinear.domain([domMin, domMax]);
  } else {
    const computedMax = d3.max(data, d => d[valueKey]) || 0;
    const domMin = cfg.valueMin ?? 0;
    const domMax = cfg.valueMax ?? computedMax;
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
      : 0;

  const barY = (d: any) =>
    orientation === 'vertical'
      ? valueLinear(d[valueKey])
      : (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? seriesBand(d[seriesKey]) ?? 0 : 0);

  const barWidth = (d: any) =>
    orientation === 'vertical'
      ? mode === 'grouped' && seriesKey ? seriesBand.bandwidth() : categoryBand.bandwidth()
      : valueLinear(d[valueKey]);

  const barHeight = (d: any) =>
    orientation === 'vertical'
      ? innerHeight - valueLinear(d[valueKey])
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
            .attr('y', innerHeight)
            .attr('height', 0);
        } else {
          rects
            .attr('y', d => barY(d))
            .attr('height', d => barHeight(d))
            .attr('x', 0)
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
    .attr('x', d => (orientation === 'vertical' ? barX(d) : 0))
    .attr('y', d => (orientation === 'vertical' ? barY(d) : barY(d)))
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
        const tooltipVal = val;
        const content = `${seriesVal !== undefined ? `<div><strong>${String(seriesVal)}</strong></div>` : ''}<div>Value: ${tooltipVal}</div>`;
        const rect = (svgEl.parentElement || svgEl).getBoundingClientRect();
        tooltipEl.style.left = `${event.clientX - rect.left}px`;
        tooltipEl.style.top = `${event.clientY - rect.top}px`;
        tooltipEl.innerHTML = content;
        tooltipEl.style.opacity = '1';
      }
    })
    .on('mousemove', function (event, d) {
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

  // Labels per bar with override text priority.
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
      const val = humanizeValue(d[valueKey]);
      const cat = String(d[categoryKey]);
      const text = cfg.swapLabelsAndValues ? cat : val;
      return overrides?.[barId(d)]?.label ?? text;
    })
    .attr('x', d =>
      orientation === 'vertical'
        ? (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? (seriesBand(d[seriesKey]) ?? 0) + seriesBand.bandwidth() / 2 : categoryBand.bandwidth() / 2)
        : (cfg.valueAlignment === 'left' ? Math.max(barWidth(d) - 6, 0) : barWidth(d) + 6)
    )
    .attr('y', d =>
      orientation === 'vertical'
        ? valueLinear(d[valueKey]) - 6
        : (categoryBand(d[categoryKey]) ?? 0) + (mode === 'grouped' && seriesKey ? (seriesBand(d[seriesKey]) ?? 0) + seriesBand.bandwidth() / 2 : categoryBand.bandwidth() / 2)
    )
    .attr('text-anchor', orientation === 'vertical' ? 'middle' : (cfg.valueAlignment === 'left' ? 'end' : 'start'))
    .style('font-size', '12px')
    .style('opacity', 0.9);

  /* ============================
     OVERLAYS (value/range)
     ============================ */

  const activeOverlays = (cfg.overlays || []).filter(o => o.visible);

  activeOverlays.forEach((ov, ovIdx) => {
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
          return innerHeight - valueLinear(d.__ovMax);
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

  // Accessibility per bar.
  bars.attr('aria-label', d => {
    const custom = overrides?.[barId(d)]?.label;
    const value = d[valueKey];
    const cat = d[categoryKey];
    return custom ? `${cat}: ${value} (${custom})` : `${cat}: ${value}`;
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

  /* ============================
     SMALL MULTIPLES FACETING
     ============================ */

  function renderSmallMultiples() {
    const facetKeys = series;
    const facetGap = 16;
    const availableHeight = innerHeight;
    const facetHeight = Math.max(100, (availableHeight - facetGap * (facetKeys.length - 1)) / facetKeys.length);

    const facets = root
      .selectAll<SVGGElement, string>('g.facet')
      .data(facetKeys, d => d)
      .join('g')
      .attr('class', 'facet')
      .attr('transform', (_d, i) => `translate(0, ${i * (facetHeight + facetGap)})`);

    facets.each((facetKey, i, nodes) => {
      const facetData = data.filter(d => d[seriesKey as string] === facetKey);
      const gFacet = d3.select(nodes[i]);

      const xBandFacet = d3
        .scaleBand<string>()
        .domain(categories)
        .range([0, innerWidth])
        .paddingInner(cfg.barPadding)
        .paddingOuter(cfg.barPadding / 2);

      const yFacet = d3
        .scaleLinear()
        .range([facetHeight, 0])
        .domain([0, d3.max(facetData, d => d[valueKey]) || 0]);

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
        .data(facetData, d => `${d[categoryKey]}`)
        .join(
          enter => enter
            .append('rect')
            .attr('class', 'bar')
            .attr('data-id', d => `${d[categoryKey]}-${facetKey}`)
            .attr('fill', d => resolveColor(d))
            .attr('rx', cfg.cornerRadius)
            .attr('x', d => xBandFacet(d[categoryKey]) ?? 0)
            .attr('width', xBandFacet.bandwidth())
            .attr('y', facetHeight)
            .attr('height', 0),
          update => update,
          exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
        );

      bars
        .transition()
        .duration(animation ? cfg.animationDuration : 0)
        .delay((_, idx) => idx * cfg.staggerDelay)
        .attr('fill', d => resolveColor(d))
        .attr('rx', cfg.cornerRadius)
        .attr('x', d => xBandFacet(d[categoryKey]) ?? 0)
        .attr('width', xBandFacet.bandwidth())
        .attr('y', d => yFacet(d[valueKey]))
        .attr('height', d => facetHeight - yFacet(d[valueKey]));

      const labels = gFacet
        .selectAll<SVGTextElement, any>('text.bar-label')
        .data(cfg.showValues ? facetData : [], d => `${d[categoryKey]}`)
        .join(
          enter => enter.append('text').attr('class', 'bar-label').attr('fill', '#0f172a'),
          update => update,
          exit => exit.transition().duration(cfg.animationDuration).style('opacity', 0).remove()
        );

      labels
        .transition()
        .duration(animation ? cfg.animationDuration : 0)
        .delay((_, idx) => idx * cfg.staggerDelay)
        .text(d => overrides?.[`${d[categoryKey]}-${facetKey}`]?.label ?? `${d[valueKey]}`)
        .attr('x', d => (xBandFacet(d[categoryKey]) ?? 0) + xBandFacet.bandwidth() / 2)
        .attr('y', d => yFacet(d[valueKey]) - 6)
        .attr('text-anchor', 'middle')
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

      bars.attr('aria-label', d => {
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
