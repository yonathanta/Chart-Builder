import * as d3 from 'd3';

type XYValue = number | Date | string | null | undefined;

export type LineChartConfig = {
  // Layout & Dimensions
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };

  // Scales
  xKey: string;
  yKey: string;
  xType?: 'time' | 'linear' | 'category';
  yType?: 'linear';
  xFormat?: string; // date format if time
  yDomain?: [number, number];

  // Line Styling
  lineColor?: string;
  lineWidth?: number;
  curveType?: 'linear' | 'monotone' | 'basis' | 'cardinal' | 'step';

  // Axis Options
  showXAxis?: boolean;
  showYAxis?: boolean;
  xTicks?: number;
  yTicks?: number;
  xTickFormat?: string | ((d: any) => string);
  yTickFormat?: string | ((d: any) => string);
  showGrid?: boolean;

  // Interactivity
  tooltip?: boolean;
  tooltipFormat?: (d: any) => string;
  showPoints?: boolean;
  pointRadius?: number;
  hoverColor?: string;

  // Animation
  animate?: boolean;
  duration?: number;
};

export type LineChartInstance = {
  update: (newData: any[]) => void;
  resize: () => void;
  destroy: () => void;
};

type ContainerLike = string | HTMLElement | null | undefined;

const DEFAULTS: Required<Omit<LineChartConfig,
  'xKey' | 'yKey' | 'xFormat' | 'xTickFormat' | 'yTickFormat' | 'yDomain'>> &
  Pick<LineChartConfig, 'xFormat' | 'xTickFormat' | 'yTickFormat' | 'yDomain'> = {
  // Layout
  width: 720,
  height: 420,
  margin: { top: 24, right: 24, bottom: 40, left: 52 },

  // Scales
  xKey: 'date',
  yKey: 'value',
  xType: 'time',
  yType: 'linear',
  xFormat: '%Y-%m-%d',
  yDomain: undefined,

  // Line Styling
  lineColor: '#2563eb',
  lineWidth: 2,
  curveType: 'linear',

  // Axes
  showXAxis: true,
  showYAxis: true,
  xTicks: 6,
  yTicks: 5,
  xTickFormat: undefined,
  yTickFormat: undefined,
  showGrid: true,

  // Interactivity
  tooltip: true,
  tooltipFormat: undefined,
  showPoints: true,
  pointRadius: 3,
  hoverColor: '#1d4ed8',

  // Animation
  animate: true,
  duration: 800,
};

function getCurveFactory(type: NonNullable<LineChartConfig['curveType']>) {
  switch (type) {
    case 'monotone':
      return d3.curveMonotoneX;
    case 'basis':
      return d3.curveBasis;
    case 'cardinal':
      return d3.curveCardinal;
    case 'step':
      return d3.curveStep;
    case 'linear':
    default:
      return d3.curveLinear;
  }
}

function isNumber(n: any): n is number {
  return typeof n === 'number' && !Number.isNaN(n);
}

function coerceContainer(container: ContainerLike): HTMLElement {
  if (!container) throw new Error('LineChart: container is required');
  if (typeof container === 'string') {
    const el = document.querySelector(container) as HTMLElement | null;
    if (!el) throw new Error(`LineChart: container selector not found: ${container}`);
    return el;
  }
  return container;
}

function getInnerSize(el: HTMLElement, fallbackWidth: number, fallbackHeight: number) {
  const rect = el.getBoundingClientRect();
  const width = Math.max(0, Math.round(rect.width || fallbackWidth));
  const height = Math.max(0, Math.round(rect.height || fallbackHeight));
  return { width, height };
}

export function createLineChart(container: ContainerLike, data: any[], config: LineChartConfig): LineChartInstance {
  const rootEl = coerceContainer(container);
  const cfg: LineChartConfig = { ...DEFAULTS, ...config };

  // Local state
  let currentData: any[] = Array.isArray(data) ? data.slice() : [];
  let destroyed = false;

  // Parse helpers
  const parseTime = cfg.xType === 'time' && cfg.xFormat ? d3.timeParse(cfg.xFormat) : undefined;
  const timeFormatterBase = cfg.xFormat ? d3.timeFormat(cfg.xFormat) : undefined;
  const numFormatter = (fmt?: string | ((d: any) => string)) =>
    typeof fmt === 'function' ? fmt : (fmt ? d3.format(fmt) : (d: any) => `${d}`);

  // Scales (initialized later)
  let xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number> | d3.ScalePoint<string>;
  let yScale: d3.ScaleLinear<number, number>;

  // Effective x-type that may adapt based on data
  let currentXType: NonNullable<LineChartConfig['xType']> = cfg.xType || 'time';

  // Dimensions
  const margins = cfg.margin || DEFAULTS.margin;
  let width = cfg.width || getInnerSize(rootEl, DEFAULTS.width, DEFAULTS.height).width;
  let height = cfg.height || DEFAULTS.height;
  let innerWidth = Math.max(0, width - margins.left - margins.right);
  let innerHeight = Math.max(0, height - margins.top - margins.bottom);

  // Root SVG
  const svg = d3.select(rootEl)
    .append('svg')
    .attr('class', 'd3-linechart')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('width', '100%')
    .attr('height', 'auto')
    .style('display', 'block');

  const g = svg.append('g').attr('transform', `translate(${margins.left},${margins.top})`);

  // Layers
  const gridLayer = g.append('g').attr('class', 'grid');
  const xAxisLayer = g.append('g').attr('class', 'x-axis').attr('transform', `translate(0,${innerHeight})`);
  const yAxisLayer = g.append('g').attr('class', 'y-axis');
  const lineLayer = g.append('g').attr('class', 'lines');
  const pointsLayer = g.append('g').attr('class', 'points');

  // Tooltip
  const enableTooltip = !!cfg.tooltip;
  let tooltipEl: HTMLDivElement | null = null;
  if (enableTooltip) {
    tooltipEl = document.createElement('div');
    tooltipEl.style.position = 'absolute';
    tooltipEl.style.pointerEvents = 'none';
    tooltipEl.style.background = 'rgba(17,24,39,0.9)';
    tooltipEl.style.color = '#fff';
    tooltipEl.style.padding = '6px 8px';
    tooltipEl.style.borderRadius = '6px';
    tooltipEl.style.fontSize = '12px';
    tooltipEl.style.transform = 'translate(12px, -28px)';
    tooltipEl.style.opacity = '0';
    tooltipEl.style.transition = 'opacity 120ms ease';
    (rootEl.parentElement || rootEl).appendChild(tooltipEl);
  }

  const overlay = g.append('rect')
    .attr('class', 'overlay')
    .attr('fill', 'transparent')
    .attr('pointer-events', enableTooltip ? 'all' : 'none')
    .attr('width', innerWidth)
    .attr('height', innerHeight);

  // Line generator
  const lineGen = d3.line<any>()
    .curve(getCurveFactory(cfg.curveType || 'linear'))
    .defined((d: any) => {
      const y = d[cfg.yKey];
      return y !== null && y !== undefined && isNumber(+y);
    })
    .x((d: any) => {
      const xv = d[cfg.xKey] as XYValue;
      if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
      if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv!);
      return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
    })
    .y((d: any) => (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]));

  function preprocess(source: any[]): any[] {
    const arr = (source || []).slice();
    if (cfg.xType === 'time' && parseTime) {
      arr.forEach(d => {
        const raw = d[cfg.xKey];
        const dt = raw instanceof Date ? raw : parseTime(String(raw));
        d.__xDate = dt as Date | null;
      });
      // Auto-fallback if no valid dates parsed
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
      // Heuristic if xType not provided
      const first = arr.find(d => d && d[cfg.xKey] !== undefined);
      if (first) {
        currentXType = isNumber(+first[cfg.xKey]) ? 'linear' : 'category';
      }
    }
    return arr;
  }

  function setScales(arr: any[]) {
    // X scale
    if (currentXType === 'time') {
      const domain = d3.extent(arr, (d: any) => d.__xDate as Date) as [Date, Date];
      xScale = d3.scaleTime().domain(domain).range([0, innerWidth]);
    } else if (currentXType === 'linear') {
      const domain = d3.extent(arr, (d: any) => +d[cfg.xKey]) as [number, number];
      xScale = d3.scaleLinear().domain(domain).nice().range([0, innerWidth]);
    } else {
      const cats = Array.from(new Set(arr.map(d => String(d[cfg.xKey]))));
      xScale = d3.scalePoint().domain(cats).range([0, innerWidth]).padding(0.5);
    }

    // Y scale
    const yMax = d3.max(arr, (d: any) => +d[cfg.yKey]) || 0;
    const yMin = d3.min(arr, (d: any) => +d[cfg.yKey]) || 0;
    const domain: [number, number] = cfg.yDomain ? cfg.yDomain : [Math.min(0, yMin), yMax];
    yScale = d3.scaleLinear().domain(domain).nice().range([innerHeight, 0]);
  }

  function renderAxes() {
    // X Axis
    if (cfg.showXAxis) {
      let ax = d3.axisBottom(xScale as any).ticks(cfg.xTicks || DEFAULTS.xTicks);
      const timeFormatter = timeFormatterBase;
      if (cfg.xTickFormat) {
        if (typeof cfg.xTickFormat === 'function') ax = ax.tickFormat(cfg.xTickFormat as any);
        else if (currentXType === 'time' && timeFormatter) ax = ax.tickFormat((d: any) => timeFormatter!(d as Date));
        else ax = ax.tickFormat(d3.format(cfg.xTickFormat));
      } else if (currentXType === 'time' && timeFormatter) {
        ax = ax.tickFormat((d: any) => timeFormatter!(d as Date));
      }
      xAxisLayer.attr('transform', `translate(0,${innerHeight})`).call(ax as any);
    } else {
      xAxisLayer.selectAll('*').remove();
    }

    // Y Axis
    if (cfg.showYAxis) {
      let ay = d3.axisLeft(yScale).ticks(cfg.yTicks || DEFAULTS.yTicks);
      if (cfg.yTickFormat) {
        if (typeof cfg.yTickFormat === 'function') ay = ay.tickFormat(cfg.yTickFormat as any);
        else ay = ay.tickFormat(d3.format(cfg.yTickFormat));
      }
      yAxisLayer.call(ay as any);
    } else {
      yAxisLayer.selectAll('*').remove();
    }
  }

  function renderGrid() {
    gridLayer.selectAll('*').remove();
    if (!cfg.showGrid) return;

    const gx = d3.axisBottom(xScale as any).ticks(cfg.xTicks || DEFAULTS.xTicks).tickSize(-innerHeight).tickFormat(() => '');
    gridLayer.append('g').attr('class', 'grid-x').attr('transform', `translate(0,${innerHeight})`).call(gx as any);

    const gy = d3.axisLeft(yScale).ticks(cfg.yTicks || DEFAULTS.yTicks).tickSize(-innerWidth).tickFormat(() => '');
    gridLayer.append('g').attr('class', 'grid-y').call(gy as any);
  }

  function renderLine(arr: any[]) {
    const path = lineLayer.selectAll('path.line').data([arr]);

    // ENTER
    path.enter()
      .append('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', cfg.lineColor || DEFAULTS.lineColor)
      .attr('stroke-width', cfg.lineWidth || DEFAULTS.lineWidth)
      .attr('d', lineGen as any)
      .each(function () {
        if (!cfg.animate) return;
        const totalLength = (this as SVGPathElement).getTotalLength();
        d3.select(this)
          .attr('stroke-dasharray', totalLength + ' ' + totalLength)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(cfg.duration || DEFAULTS.duration)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      });

    // UPDATE
    path
      .attr('stroke', cfg.lineColor || DEFAULTS.lineColor)
      .attr('stroke-width', cfg.lineWidth || DEFAULTS.lineWidth)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(d3.easeCubicOut)
      .attr('d', lineGen as any);

    // EXIT
    path.exit().remove();
  }

  function renderPoints(arr: any[]) {
    const show = !!cfg.showPoints;
    const sel = pointsLayer.selectAll('circle.point').data(show ? arr.filter((d: any) => lineGen.defined()(d)) : [], (d: any) => String(d[cfg.xKey]));

    // ENTER
    const entered = sel.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('r', cfg.pointRadius || DEFAULTS.pointRadius)
      .attr('fill', cfg.lineColor || DEFAULTS.lineColor)
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.2)
      .attr('cx', (d: any) => {
        const xv = d[cfg.xKey] as XYValue;
        if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
        if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv!);
        return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
      })
      .attr('cy', (d: any) => (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]))
      .on('mouseover', function () { d3.select(this).attr('fill', cfg.hoverColor || DEFAULTS.hoverColor); })
      .on('mouseout', function () { d3.select(this).attr('fill', cfg.lineColor || DEFAULTS.lineColor); });

    // UPDATE
    sel.merge(entered)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(d3.easeCubicOut)
      .attr('r', cfg.pointRadius || DEFAULTS.pointRadius)
      .attr('fill', cfg.lineColor || DEFAULTS.lineColor)
      .attr('cx', (d: any) => {
        const xv = d[cfg.xKey] as XYValue;
        if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
        if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv!);
        return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
      })
      .attr('cy', (d: any) => (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]));

    // EXIT
    sel.exit().remove();
  }

  function pointerHandlers(arr: any[]) {
    if (!enableTooltip) return;

    const timeFormatter = timeFormatterBase;
    const formatX = currentXType === 'time' && timeFormatter
      ? (d: any) => timeFormatter!(d as Date)
      : (cfg.xTickFormat ? numFormatter(cfg.xTickFormat) : (d: any) => `${d}`);
    const formatY = cfg.yTickFormat ? numFormatter(cfg.yTickFormat) : (d: any) => `${d}`;

    const bisect = currentXType !== 'category' ? d3.bisector((d: any) => (currentXType === 'time' ? (d.__xDate as Date).getTime() : +d[cfg.xKey])).left : null;

    overlay
      .on('mousemove', function () {
        if (!tooltipEl) return;
        const [mx, my] = d3.mouse(this as any);

        let nearest: any | null = null;
        if (currentXType === 'category') {
          // For categories, find the closest category by x distance.
          const pts = arr.map(d => {
            const x = (xScale as d3.ScalePoint<string>)(String(d[cfg.xKey])) as number;
            const y = (yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey]);
            return { d, x, y, dx: Math.abs(mx - x) };
          });
          pts.sort((a, b) => a.dx - b.dx);
          nearest = pts[0]?.d || null;
        } else {
          // time or linear
          const getXVal = (d: any) => currentXType === 'time' ? (d.__xDate as Date).getTime() : +d[cfg.xKey];
          const xArr = arr.map(getXVal);
          const idx = bisect!(xArr as any, currentXType === 'time' ? (xScale as any).invert(mx).getTime() : (xScale as any).invert(mx));
          const i0 = Math.max(0, idx - 1);
          const i1 = Math.min(arr.length - 1, idx);
          const d0 = arr[i0];
          const d1 = arr[i1];
          nearest = (!d1 || (mx - xPos(d0)) < (xPos(d1) - mx)) ? d0 : d1;
        }

        if (!nearest) return;
        const xv = nearest[cfg.xKey] as XYValue;
        const cx = currentXType === 'time' ? (xScale as d3.ScaleTime<number, number>)(nearest.__xDate as Date)
          : currentXType === 'linear' ? (xScale as d3.ScaleLinear<number, number>)(+xv!)
            : (xScale as d3.ScalePoint<string>)(String(xv)) as number;
        const cy = (yScale as d3.ScaleLinear<number, number>)(+nearest[cfg.yKey]);
        // Place tooltip near cursor for better readability
        tooltipEl.style.left = `${margins.left + mx}px`;
        tooltipEl.style.top = `${margins.top + my}px`;
        const xLabel = cfg.xType === 'time' ? (nearest.__xDate as Date) : xv;
        const fallback = `<div><strong>${formatX(xLabel)}</strong></div><div>${formatY(+nearest[cfg.yKey])}</div>`;
        tooltipEl.innerHTML = cfg.tooltipFormat ? cfg.tooltipFormat(nearest) : fallback;
        tooltipEl.style.opacity = '1';
      })
      .on('mouseout', function () {
        if (!tooltipEl) return;
        tooltipEl.style.opacity = '0';
      });

    function xPos(d: any) {
      const xv = d[cfg.xKey] as XYValue;
      if (currentXType === 'time') return (xScale as d3.ScaleTime<number, number>)(d.__xDate as Date);
      if (currentXType === 'linear') return (xScale as d3.ScaleLinear<number, number>)(+xv!);
      return (xScale as d3.ScalePoint<string>)(String(xv)) as number;
    }
  }

  function draw() {
    if (destroyed) return;
    const arr = preprocess(currentData);
    setScales(arr);
    overlay.attr('width', innerWidth).attr('height', innerHeight);
    renderGrid();
    renderAxes();
    renderLine(arr);
    renderPoints(arr);
    pointerHandlers(arr);
  }

  function resizeInternal() {
    if (destroyed) return;
    const rect = getInnerSize(rootEl, cfg.width || DEFAULTS.width, cfg.height || DEFAULTS.height);
    width = cfg.width || rect.width;
    height = cfg.height || rect.height;
    innerWidth = Math.max(0, width - margins.left - margins.right);
    innerHeight = Math.max(0, height - margins.top - margins.bottom);
    svg.attr('viewBox', `0 0 ${width} ${height}`);
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
