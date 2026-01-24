import * as d3 from 'd3';

export type AreaChartConfig = {
  // 1. Layout Configuration
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };
  responsive?: boolean;
  backgroundColor?: string;

  // 2. Data Mapping Options
  xKey: string;
  yKey: string;
  xType?: 'time' | 'linear' | 'category';
  yType?: 'linear';
  xParseFormat?: string; // for time parsing
  sortData?: boolean;

  // 3. Scale Configuration
  xDomain?: [number | Date | string, number | Date | string];
  yDomain?: [number, number];
  yNice?: boolean;
  padding?: number; // category padding

  // 4. Area Generator Options
  areaColor?: string;
  areaOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  curveType?: 'linear' | 'monotone' | 'basis' | 'cardinal' | 'step';
  defined?: (d: any) => boolean; // custom missing handler

  // 5. Axis Configuration
  showXAxis?: boolean;
  showYAxis?: boolean;
  xTicks?: number;
  yTicks?: number;
  xTickFormat?: string | ((d: any) => string);
  yTickFormat?: string | ((d: any) => string);
  axisColor?: string;
  showGrid?: boolean;
  gridColor?: string;

  // 6. Point and Marker Options
  showPoints?: boolean;
  pointRadius?: number;
  pointColor?: string;
  pointStroke?: string;

  // 7. Tooltip & Interaction
  tooltip?: boolean;
  tooltipFormat?: (d: any) => string;
  hoverLine?: boolean;
  hoverColor?: string;
  focusCircle?: boolean;

  // 8. Animation Options
  animate?: boolean;
  duration?: number;
  easing?: (t: number) => number; // d3-ease fn
};

export type AreaChartInstance = {
  update: (newData: any[]) => void;
  resize: () => void;
  destroy: () => void;
};

const DEFAULTS: Required<Omit<AreaChartConfig,
  'xKey' | 'yKey' | 'xParseFormat' | 'xDomain' | 'yDomain' | 'xTickFormat' | 'yTickFormat' | 'defined' | 'tooltipFormat'>> &
  Pick<AreaChartConfig, 'xParseFormat' | 'xDomain' | 'yDomain' | 'xTickFormat' | 'yTickFormat' | 'defined' | 'tooltipFormat'> = {
  // Layout
  width: 720,
  height: 420,
  margin: { top: 24, right: 24, bottom: 40, left: 52 },
  responsive: true,
  backgroundColor: '#ffffff',

  // Data mapping
  xType: 'time',
  yType: 'linear',
  xParseFormat: '%Y-%m-%d',
  sortData: false,

  // Scale
  xDomain: undefined,
  yDomain: undefined,
  yNice: true,
  padding: 0.5,

  // Area styling
  areaColor: '#2563eb',
  areaOpacity: 0.24,
  strokeColor: '#1d4ed8',
  strokeWidth: 2,
  curveType: 'linear',
  defined: undefined,

  // Axes / Grid
  showXAxis: true,
  showYAxis: true,
  xTicks: 6,
  yTicks: 5,
  xTickFormat: undefined,
  yTickFormat: undefined,
  axisColor: '#cbd5e1',
  showGrid: true,
  gridColor: '#e2e8f0',

  // Points
  showPoints: true,
  pointRadius: 3,
  pointColor: '#1d4ed8',
  pointStroke: '#ffffff',

  // Tooltip & interaction
  tooltip: true,
  tooltipFormat: undefined,
  hoverLine: true,
  hoverColor: '#94a3b8',
  focusCircle: true,

  // Animation
  animate: true,
  duration: 800,
  easing: d3.easeCubicOut,
};

function getCurveFactory(type: NonNullable<AreaChartConfig['curveType']>) {
  switch (type) {
    case 'monotone': return d3.curveMonotoneX;
    case 'basis': return d3.curveBasis;
    case 'cardinal': return d3.curveCardinal;
    case 'step': return d3.curveStep;
    case 'linear':
    default: return d3.curveLinear;
  }
}

function coerceContainer(container: string | HTMLElement): HTMLElement {
  if (typeof container === 'string') {
    const el = document.querySelector(container) as HTMLElement | null;
    if (!el) throw new Error(`AreaChart: container selector not found: ${container}`);
    return el;
  }
  if (!container) throw new Error('AreaChart: container element is required');
  return container;
}

function isNumber(n: any): n is number {
  return typeof n === 'number' && !Number.isNaN(n);
}

export function drawAreaChart(container: string | HTMLElement, data: any[], config: AreaChartConfig): AreaChartInstance {
  const rootEl = coerceContainer(container);
  const cfg: AreaChartConfig = { ...DEFAULTS, ...config };

  // Local state
  let currentData: any[] = Array.isArray(data) ? data.slice() : [];
  let destroyed = false;
  let currentXType: NonNullable<AreaChartConfig['xType']> = cfg.xType || 'time';

  const parseTime = cfg.xParseFormat ? d3.timeParse(cfg.xParseFormat) : undefined;
  const timeFormatter = cfg.xParseFormat ? d3.timeFormat(cfg.xParseFormat) : undefined;

  // Dimensions
  const margin = cfg.margin || DEFAULTS.margin;
  let width = cfg.width || DEFAULTS.width;
  let height = cfg.height || DEFAULTS.height;
  let innerWidth = Math.max(0, width - margin.left - margin.right);
  let innerHeight = Math.max(0, height - margin.top - margin.bottom);

  // Root SVG
  const svg = d3.select(rootEl)
    .append('svg')
    .attr('class', 'd3-area-chart')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', cfg.responsive ? '100%' : width)
    .attr('height', cfg.responsive ? 'auto' : height)
    .style('display', 'block')
    .style('background', cfg.backgroundColor || DEFAULTS.backgroundColor);

  const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

  // Persistent layers
  const gridLayer = g.append('g').attr('class', 'grid');
  const xAxisLayer = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerHeight})`);
  const yAxisLayer = g.append('g').attr('class', 'y-axis');
  const areaLayer = g.append('g').attr('class', 'area-layer');
  const lineLayer = g.append('g').attr('class', 'line-layer');
  const pointsLayer = g.append('g').attr('class', 'points-layer');
  const interactionLayer = g.append('g').attr('class', 'interaction-layer');

  // Tooltip and focus UI
  const enableTooltip = !!cfg.tooltip;
  let tooltipEl: HTMLDivElement | null = null;
  if (enableTooltip) {
    tooltipEl = document.createElement('div');
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.background = 'rgba(17, 24, 39, 0.9)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.padding = '6px 8px';
    tooltipEl.style.borderRadius = '6px';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.transform = 'translate(12px, -28px)';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transition = 'opacity 120ms ease';
    (rootEl.parentElement || rootEl).appendChild(tooltipEl);
  }

  const overlay = interactionLayer.append('rect')
    .attr('class', 'overlay')
    .attr('fill', 'transparent')
    .attr('pointer-events', enableTooltip ? 'all' : 'none')
    .attr('width', innerWidth)
    .attr('height', innerHeight);

  const hoverLine = interactionLayer.append('line')
    .attr('class', 'hover-line')
    .attr('stroke', cfg.hoverColor || DEFAULTS.hoverColor)
    .attr('stroke-width', 1.2)
    .attr('stroke-dasharray', '4 4')
    .style('opacity', 0);

  const focusCircle = interactionLayer.append('circle')
    .attr('class', 'focus-circle')
    .attr('r', (cfg.pointRadius || DEFAULTS.pointRadius) + 2)
    .attr('fill', cfg.pointColor || DEFAULTS.pointColor)
    .attr('stroke', cfg.pointStroke || DEFAULTS.pointStroke)
    .style('opacity', 0);

  // Scales
  let xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number> | d3.ScalePoint<string>;
  let yScale: d3.ScaleLinear<number, number>;

  // Area + line generators
  const areaGen = d3.area<any>()
    .curve(getCurveFactory(cfg.curveType || 'linear'))
    .defined((d: any) => {
      const userDefined = cfg.defined ? cfg.defined(d) : true;
      const yv = d[cfg.yKey];
      return userDefined && yv !== null && yv !== undefined && isNumber(+yv);
    })
    .x((d: any) => {
      const xv = d[cfg.xKey];
      if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
      if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv);
      return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
    })
    .y0(() => baseline())
    .y1((d: any) => (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]));

  const lineGen = d3.line<any>()
    .curve(getCurveFactory(cfg.curveType || 'linear'))
    .defined(areaGen.defined())
    .x(areaGen.x())
    .y(areaGen.y1() as any);

  function baseline() {
    const dom = yScale.domain() as [number, number];
    const zeroIn = dom[0] <= 0 && dom[1] >= 0;
    const anchor = zeroIn ? 0 : dom[0] ?? 0;
    return yScale(anchor);
  }

  function preprocess(source: any[]) {
    const arr = (source || []).slice();
    if (cfg.sortData) {
      arr.sort((a, b) => {
        const av = a[cfg.xKey];
        const bv = b[cfg.xKey];
        if (cfg.xType === 'time') return (a.__xDate as Date).getTime() - (b.__xDate as Date).getTime();
        if (cfg.xType === 'linear') return (+av) - (+bv);
        return String(av).localeCompare(String(bv));
      });
    }
    if (cfg.xType === 'time' && parseTime) {
      arr.forEach(d => {
        const raw = d[cfg.xKey];
        const dt = raw instanceof Date ? raw : parseTime(String(raw));
        d.__xDate = dt as Date | null;
      });
      const validDates = arr.filter(d => d.__xDate instanceof Date);
      if (validDates.length === 0) {
        const allNumeric = arr.every(d => d[cfg.xKey] !== null && d[cfg.xKey] !== undefined && isNumber(+d[cfg.xKey]));
        currentXType = allNumeric ? 'linear' : 'category';
      } else {
        currentXType = 'time';
      }
    } else if (cfg.xType) {
      currentXType = cfg.xType;
    } else {
      const first = arr.find(d => d && d[cfg.xKey] !== undefined);
      currentXType = first && isNumber(+first[cfg.xKey]) ? 'linear' : 'category';
    }
    return arr;
  }

  function setScales(arr: any[]) {
    // X scale
    if (currentXType === 'time') {
      const dom = cfg.xDomain
        ? cfg.xDomain as [Date, Date]
        : (d3.extent(arr, (d: any) => d.__xDate as Date) as [Date, Date]);
      xScale = d3.scaleTime().domain(dom).range([0, innerWidth]);
    } else if (currentXType === 'linear') {
      const dom = cfg.xDomain
        ? (cfg.xDomain as [number, number])
        : (d3.extent(arr, (d: any) => +d[cfg.xKey]) as [number, number]);
      xScale = d3.scaleLinear().domain(dom).nice().range([0, innerWidth]);
    } else {
      const cats = Array.from(new Set(arr.map(d => String(d[cfg.xKey]))));
      xScale = d3.scalePoint().domain(cats).range([0, innerWidth]).padding(cfg.padding ?? DEFAULTS.padding);
    }

    // Y scale
    const yMax = d3.max(arr, (d: any) => +d[cfg.yKey]) || 0;
    const yMin = d3.min(arr, (d: any) => +d[cfg.yKey]) || 0;
    const dom: [number, number] = cfg.yDomain ? cfg.yDomain : [Math.min(0, yMin), yMax];
    yScale = d3.scaleLinear().domain(dom).range([innerHeight, 0]);
    if (cfg.yNice ?? DEFAULTS.yNice) yScale.nice();
  }

  function renderAxes() {
    // X Axis
    if (cfg.showXAxis) {
      let ax = d3.axisBottom(xScale as any).ticks(cfg.xTicks || DEFAULTS.xTicks);
      if (cfg.xTickFormat) {
        if (typeof cfg.xTickFormat === 'function') ax = ax.tickFormat(cfg.xTickFormat as any);
        else if (currentXType === 'time' && timeFormatter) ax = ax.tickFormat((d: any) => timeFormatter!(d as Date));
        else ax = ax.tickFormat(d3.format(cfg.xTickFormat as string) as any);
      } else if (currentXType === 'time' && timeFormatter) {
        ax = ax.tickFormat((d: any) => timeFormatter!(d as Date));
      }
      xAxisLayer.attr('transform', `translate(0,${innerHeight})`).call(ax as any);
      xAxisLayer.selectAll('.domain, .tick line').attr('stroke', cfg.axisColor || DEFAULTS.axisColor);
    } else {
      xAxisLayer.selectAll('*').remove();
    }

    // Y Axis
    if (cfg.showYAxis) {
      let ay = d3.axisLeft(yScale).ticks(cfg.yTicks || DEFAULTS.yTicks);
      if (cfg.yTickFormat) {
        if (typeof cfg.yTickFormat === 'function') ay = ay.tickFormat(cfg.yTickFormat as any);
        else ay = ay.tickFormat(d3.format(cfg.yTickFormat as string) as any);
      }
      yAxisLayer.call(ay as any);
      yAxisLayer.selectAll('.domain, .tick line').attr('stroke', cfg.axisColor || DEFAULTS.axisColor);
    } else {
      yAxisLayer.selectAll('*').remove();
    }
  }

  function renderGrid() {
    gridLayer.selectAll('*').remove();
    if (!cfg.showGrid) return;

    const gx = d3.axisBottom(xScale as any)
      .ticks(cfg.xTicks || DEFAULTS.xTicks)
      .tickSize(-innerHeight)
      .tickFormat(() => '');
    const gy = d3.axisLeft(yScale)
      .ticks(cfg.yTicks || DEFAULTS.yTicks)
      .tickSize(-innerWidth)
      .tickFormat(() => '');

    gridLayer.append('g').attr('class', 'grid-x').attr('transform', `translate(0,${innerHeight})`).call(gx as any)
      .selectAll('line').attr('stroke', cfg.gridColor || DEFAULTS.gridColor).attr('opacity', 0.6);
    gridLayer.append('g').attr('class', 'grid-y').call(gy as any)
      .selectAll('line').attr('stroke', cfg.gridColor || DEFAULTS.gridColor).attr('opacity', 0.6);
  }

  function renderArea(arr: any[]) {
    const areaSel = areaLayer.selectAll<SVGPathElement, any>('path.area').data([arr]);
    const enter = areaSel.enter()
      .append('path')
      .attr('class', 'area')
      .attr('fill', cfg.areaColor || DEFAULTS.areaColor)
      .attr('opacity', cfg.areaOpacity ?? DEFAULTS.areaOpacity)
      .attr('d', areaGen as any);

    (areaSel.merge(enter) as d3.Selection<SVGPathElement, any, SVGGElement, unknown>)
      .attr('fill', cfg.areaColor || DEFAULTS.areaColor)
      .attr('opacity', cfg.areaOpacity ?? DEFAULTS.areaOpacity)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(cfg.easing || DEFAULTS.easing)
      .attr('d', areaGen as any);

    if (cfg.animate) {
      enter.each(function () {
        const totalLength = (this as SVGPathElement).getTotalLength();
        d3.select(this)
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(cfg.duration || DEFAULTS.duration)
          .ease(cfg.easing || DEFAULTS.easing)
          .attr('stroke-dashoffset', 0);
      });
    }

    areaSel.exit().remove();
  }

  function renderStroke(arr: any[]) {
    const stroke = lineLayer.selectAll<SVGPathElement, any>('path.stroke').data([arr]);
    const enter = stroke.enter()
      .append('path')
      .attr('class', 'stroke')
      .attr('fill', 'none')
      .attr('stroke', cfg.strokeColor || DEFAULTS.strokeColor)
      .attr('stroke-width', cfg.strokeWidth ?? DEFAULTS.strokeWidth)
      .attr('d', lineGen as any);

    (stroke.merge(enter) as d3.Selection<SVGPathElement, any, SVGGElement, unknown>)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(cfg.easing || DEFAULTS.easing)
      .attr('stroke', cfg.strokeColor || DEFAULTS.strokeColor)
      .attr('stroke-width', cfg.strokeWidth ?? DEFAULTS.strokeWidth)
      .attr('d', lineGen as any);

    stroke.exit().remove();
  }

  function cx(d: any) {
    const xv = d[cfg.xKey];
    if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
    if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv);
    return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
  }
  function cy(d: any) { return (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]); }

  function renderPoints(arr: any[]) {
    const show = !!cfg.showPoints;
    const definedFn = areaGen.defined() as (d: any, i: number, arr: any[]) => boolean;
    const filtered = show ? arr.filter((d: any, i: number, a: any[]) => definedFn(d, i, a)) : [];
    const sel = pointsLayer.selectAll<SVGCircleElement, any>('circle.point').data(filtered, (d: any) => String(d[cfg.xKey]));

    const entered = sel.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('r', cfg.pointRadius ?? DEFAULTS.pointRadius)
      .attr('fill', cfg.pointColor || DEFAULTS.pointColor)
      .attr('stroke', cfg.pointStroke || DEFAULTS.pointStroke)
      .attr('cx', cx)
      .attr('cy', cy);

    (sel.merge(entered) as d3.Selection<SVGCircleElement, any, SVGGElement, unknown>)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(cfg.easing || DEFAULTS.easing)
      .attr('r', cfg.pointRadius ?? DEFAULTS.pointRadius)
      .attr('fill', cfg.pointColor || DEFAULTS.pointColor)
      .attr('stroke', cfg.pointStroke || DEFAULTS.pointStroke)
      .attr('cx', cx)
      .attr('cy', cy);

    sel.exit().remove();
  }

  function pointerHandlers(arr: any[]) {
    if (!enableTooltip && !cfg.hoverLine && !cfg.focusCircle) return;

    const formatX = currentXType === 'time' && timeFormatter
      ? (d: any) => timeFormatter!(d as Date)
      : (cfg.xTickFormat ? (typeof cfg.xTickFormat === 'function' ? cfg.xTickFormat : d3.format(cfg.xTickFormat)) : (d: any) => `${d}`);
    const formatY = cfg.yTickFormat ? (typeof cfg.yTickFormat === 'function' ? cfg.yTickFormat : d3.format(cfg.yTickFormat)) : (d: any) => `${d}`;

    const bisect = currentXType !== 'category'
      ? d3.bisector((d: any) => currentXType === 'time' ? (d.__xDate as Date).getTime() : +d[cfg.xKey]).left
      : null;

    overlay
      .on('mousemove', (event) => {
        const [mx] = d3.pointer(event, overlay.node() as any);

        let nearest: any | null = null;
        if (currentXType === 'category') {
          const pts = arr.map(d => {
            const px = (xScale as d3.ScalePoint<string>)(String(d[cfg.xKey])) as number;
            return { d, px, dx: Math.abs(mx - px) };
          });
          pts.sort((a, b) => a.dx - b.dx);
          nearest = pts[0]?.d || null;
        } else {
          const target = currentXType === 'time'
            ? (xScale as d3.ScaleTime<number, number>).invert(mx).getTime()
            : (xScale as d3.ScaleLinear<number, number>).invert(mx);
          const idx = bisect!(arr.map(d => currentXType === 'time' ? (d.__xDate as Date).getTime() : +d[cfg.xKey]), target);
          const i0 = Math.max(0, idx - 1);
          const i1 = Math.min(arr.length - 1, idx);
          const d0 = arr[i0];
          const d1 = arr[i1];
          nearest = !d1 || Math.abs(cx(d0) - mx) < Math.abs(cx(d1) - mx) ? d0 : d1;
        }
        if (!nearest) return;

        const px = cx(nearest);
        const py = cy(nearest);

        if (cfg.hoverLine) {
          hoverLine.attr('x1', px).attr('x2', px).attr('y1', 0).attr('y2', innerHeight).style('opacity', 1);
        }
        if (cfg.focusCircle) {
          focusCircle.attr('cx', px).attr('cy', py).style('opacity', 1);
        }

        if (tooltipEl && cfg.tooltip) {
          const xLabel = currentXType === 'time' ? (nearest.__xDate as Date) : nearest[cfg.xKey];
          const content = cfg.tooltipFormat
            ? cfg.tooltipFormat(nearest)
            : `<div><strong>${formatX(xLabel)}</strong></div><div>${formatY(+nearest[cfg.yKey])}</div>`;
          // Position tooltip near the cursor instead of the data point
          tooltipEl.style.left = `${margin.left + mx}px`;
          tooltipEl.style.top = `${margin.top + my}px`;
          tooltipEl.innerHTML = content;
          tooltipEl.style.opacity = '1';
        }
      })
      .on('mouseout', () => {
        hoverLine.style('opacity', 0);
        focusCircle.style('opacity', 0);
        if (tooltipEl) tooltipEl.style.opacity = '0';
      });
  }

  function draw() {
    if (destroyed) return;
    const arr = preprocess(currentData);
    setScales(arr);
    overlay.attr('width', innerWidth).attr('height', innerHeight);
    renderGrid();
    renderAxes();
    renderArea(arr);
    renderStroke(arr);
    renderPoints(arr);
    pointerHandlers(arr);
  }

  function resizeInternal() {
    if (destroyed) return;
    width = cfg.width || (rootEl.getBoundingClientRect().width || DEFAULTS.width);
    height = cfg.height || DEFAULTS.height;
    innerWidth = Math.max(0, width - margin.left - margin.right);
    innerHeight = Math.max(0, height - margin.top - margin.bottom);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
    if (!cfg.responsive) svg.attr('width', width).attr('height', height);
    xAxisLayer.attr('transform', `translate(0,${innerHeight})`);
    draw();
  }

  // Initial render
  draw();

  // Public API
  return {
    update(newData: any[]) {
      currentData = Array.isArray(newData) ? newData.slice() : [];
      draw();
    },
    resize() {
      resizeInternal();
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      svg.remove();
      if (tooltipEl && tooltipEl.parentElement) tooltipEl.parentElement.removeChild(tooltipEl);
    }
  };
}

// ===== Defaults export =====
export const AREA_V7_DEFAULTS = DEFAULTS;

// ===== Example usage =====
// const sample = [
//   { date: '2024-01-01', value: 100 },
//   { date: '2024-02-01', value: 140 },
//   { date: '2024-03-01', value: 90 },
// ];
// const chart = drawAreaChart('#area-container', sample, {
//   xKey: 'date',
//   yKey: 'value',
//   xType: 'time',
//   xParseFormat: '%Y-%m-%d',
//   areaColor: '#22c55e',
//   strokeColor: '#16a34a',
//   curveType: 'monotone',
//   tooltip: true,
// });
// chart.update(sample.map(d => ({ ...d, value: d.value * 1.1 })));
// chart.resize();
// chart.destroy();
//
// ===== Minimal HTML =====
// <div id="area-container" style="width:100%;max-width:800px;"></div>
