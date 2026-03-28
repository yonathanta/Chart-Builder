import * as d3 from 'd3';

export type LineChartConfig = {
  // Layout & Dimensions
  width?: number;
  height?: number;
  margin?: { top: number; right: number; bottom: number; left: number };

  // Scales
  xKey: string;
  yKey: string;
  seriesField?: string;
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
  showLegend?: boolean;
  legendPosition?: 'top' | 'bottom' | 'left' | 'right';
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

  // Title
  title?: string;
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
  showLegend: true,
  legendPosition: 'right',
  xTicks: 6,
  yTicks: 5,
  xTickFormat: undefined,
  yTickFormat: undefined,
  showGrid: true,

  // Interactivity
  tooltip: true,
  tooltipFormat: (d: any) => `${d}`,
  showPoints: true,
  pointRadius: 3,
  hoverColor: '#1d4ed8',

  // Animation
  animate: true,
  duration: 800,

  // Title
  title: '',
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

function coalesceNum(n: number | undefined | null, fallback = 0): number {
  return (n === undefined || n === null || Number.isNaN(n)) ? fallback : n;
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
  const parseYear = d3.timeParse('%Y');
  let timeFormatter = cfg.xFormat ? d3.timeFormat(cfg.xFormat) : undefined;
  let detectedYearOnlyAxis = false;
  const numFormatter = (fmt?: string | ((d: any) => string)) =>
    typeof fmt === 'function' ? fmt : (fmt ? d3.format(fmt) : (d: any) => `${d}`);

  // Scales (initialized later)
  let xScale: d3.ScaleTime<number, number> | d3.ScaleLinear<number, number> | d3.ScalePoint<string> = d3.scaleLinear() as any;
  let yScale: d3.ScaleLinear<number, number> = d3.scaleLinear();

  // Effective x-type that may adapt based on data
  let currentXType: NonNullable<LineChartConfig['xType']> = cfg.xType || 'time';

  function preprocess(source: any[]): any[] {
    const arr = (source || []).slice();
    if (cfg.xType === 'time') {
      let yearLikeCount = 0;
      let sampledCount = 0;

      arr.forEach(d => {
        const raw = d[cfg.xKey];
        const rawString = String(raw ?? '').trim();
        let dt: Date | null = null;

        if (raw instanceof Date) {
          dt = raw;
        } else {
          if (parseTime) {
            dt = parseTime(rawString);
          }

          if (!dt && /^\d{4}$/.test(rawString)) {
            dt = parseYear(rawString);
          }

          if (!dt) {
            const native = new Date(rawString);
            if (!Number.isNaN(native.getTime())) {
              dt = native;
            }
          }
        }

        if (rawString.length > 0) {
          sampledCount += 1;
          if (/^\d{4}$/.test(rawString)) {
            yearLikeCount += 1;
          }
        }

        d.__xDate = dt as Date | null;
      });

      detectedYearOnlyAxis = sampledCount > 0 && yearLikeCount / sampledCount >= 0.8;
      if (detectedYearOnlyAxis && !cfg.xTickFormat) {
        timeFormatter = d3.timeFormat('%Y');
      }

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

  // Generate scales early to calculate margins
  function setScales(arr: any[]) {
    // X scale
    if (currentXType === 'time') {
      const domain = d3.extent(arr, (d: any) => d.__xDate as Date) as [Date, Date];
      xScale = d3.scaleTime().domain(domain).range([0, 100]); // Temporary range
    } else if (currentXType === 'linear') {
      const domain = d3.extent(arr, (d: any) => +d[cfg.xKey]) as [number, number];
      xScale = d3.scaleLinear().domain(domain).nice().range([0, 100]);
    } else {
      const cats = Array.from(new Set(arr.map(d => String(d[cfg.xKey]))));
      xScale = d3.scalePoint().domain(cats).range([0, 100]).padding(0.5);
    }

    // Y scale
    const yMax = d3.max(arr, (d: any) => +d[cfg.yKey]) || 0;
    const yMin = d3.min(arr, (d: any) => +d[cfg.yKey]) || 0;
    const domain: [number, number] = cfg.yDomain ? cfg.yDomain : [Math.min(0, yMin), yMax];
    yScale = d3.scaleLinear().domain(domain).nice().range([100, 0]);
  }

  const preprocessedData = preprocess(currentData);
  setScales(preprocessedData);

  // Dynamically calculate margins
  let dynamicMarginLeft = DEFAULTS.margin.left;
  let dynamicMarginRight = DEFAULTS.margin.right;
  let computedWidth = cfg.width || getInnerSize(rootEl, DEFAULTS.width, DEFAULTS.height).width;
  let computedHeight = cfg.height || DEFAULTS.height;

  // Temporary SVG for text measurement
  const tempSvg = d3.select(rootEl).append('svg').style('visibility', 'hidden').style('position', 'absolute');
  const tempText = tempSvg.append('text').style('font-size', '10px').style('font-family', 'sans-serif');

  if (cfg.showYAxis) {
    let maxYLabelWidth = 0;
    const ticks = yScale.ticks(cfg.yTicks || DEFAULTS.yTicks);
    const tickFormatFn = cfg.yTickFormat ? (typeof cfg.yTickFormat === 'function' ? cfg.yTickFormat : d3.format(cfg.yTickFormat)) : (d: any) => `${d}`;

    ticks.forEach(tick => {
      tempText.text(tickFormatFn(tick));
      const bbox = (tempText.node() as SVGTextElement).getBBox();
      if (bbox.width > maxYLabelWidth) maxYLabelWidth = bbox.width;
    });
    dynamicMarginLeft = Math.max(DEFAULTS.margin.left, maxYLabelWidth + 15);
  }

  tempSvg.remove();

  // Dimensions
  const margins = {
    ...DEFAULTS.margin,
    ...(cfg.margin || {}),
    top: cfg.title ? 65 : (cfg.margin?.top || DEFAULTS.margin.top),
    left: dynamicMarginLeft,
    right: dynamicMarginRight
  };
  let width = computedWidth;
  let height = computedHeight;
  let innerWidth = Math.max(0, width - margins.left - margins.right);
  let innerHeight = Math.max(0, height - margins.top - margins.bottom);

  // Update scale ranges with precise inner widths
  if (currentXType === 'time') {
    (xScale as d3.ScaleTime<number, number>).range([0, innerWidth]);
  } else if (currentXType === 'linear') {
    (xScale as d3.ScaleLinear<number, number>).range([0, innerWidth]);
  } else {
    (xScale as d3.ScalePoint<string>).range([0, innerWidth]);
  }
  yScale.range([innerHeight, 0]);


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
  const legendLayer = g.append('g').attr('class', 'legend');

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

  // Render Title
  if (cfg.title) {
    svg.selectAll('text.chart-title').remove();
    svg.append('text')
      .attr('class', 'chart-title')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .style('fill', '#374151')
      .text(cfg.title);
  }

  // Line generator
  const lineGen = d3.line<any>()
    .curve(getCurveFactory(cfg.curveType || 'linear'))
    .defined((d: any) => {
      const y = d[cfg.yKey];
      return y !== null && y !== undefined && isNumber(+y);
    })
    .x((d: any) => {
      const xv = d[cfg.xKey];
      if (currentXType === 'time') return coalesceNum((xScale as d3.ScaleTime<number, number>)(d.__xDate as Date));
      if (currentXType === 'linear') return coalesceNum((xScale as d3.ScaleLinear<number, number>)(+xv));
      return coalesceNum((xScale as d3.ScalePoint<string>)(String(xv)) as number);
    })
    .y((d: any) => coalesceNum((yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey])));

  const seriesField = cfg.seriesField;
  const seriesColorScale = d3.scaleOrdinal<string, string>(d3.schemeTableau10);

  function getSeriesKey(d: any): string {
    if (!seriesField) {
      return '__single__';
    }

    const value = d?.[seriesField];
    return value === undefined || value === null || value === '' ? 'Unknown' : String(value);
  }

  function getXSortValue(d: any): number | string {
    if (currentXType === 'time') {
      const dt = d?.__xDate as Date | null | undefined;
      return dt instanceof Date ? dt.getTime() : Number.NEGATIVE_INFINITY;
    }

    if (currentXType === 'linear') {
      const num = Number(d?.[cfg.xKey]);
      return Number.isFinite(num) ? num : Number.NEGATIVE_INFINITY;
    }

    return String(d?.[cfg.xKey] ?? '');
  }

  function compareByX(a: any, b: any): number {
    const left = getXSortValue(a);
    const right = getXSortValue(b);

    if (typeof left === 'string' && typeof right === 'string') {
      return left.localeCompare(right);
    }

    return Number(left) - Number(right);
  }

  function getXBucketKey(d: any): string {
    if (currentXType === 'time') {
      const dt = d?.__xDate as Date | null | undefined;
      return dt instanceof Date ? String(dt.getTime()) : String(d?.[cfg.xKey] ?? '');
    }

    if (currentXType === 'linear') {
      const num = Number(d?.[cfg.xKey]);
      return Number.isFinite(num) ? String(num) : String(d?.[cfg.xKey] ?? '');
    }

    return String(d?.[cfg.xKey] ?? '');
  }

  function aggregateSeriesValues(values: any[]): any[] {
    const groupedByX = d3.group(values, (d: any) => getXBucketKey(d));

    return Array.from(groupedByX.values())
      .map((rows) => {
        const numericRows = rows.filter((row: any) => isNumber(+row[cfg.yKey]));
        if (numericRows.length === 0) {
          return null;
        }

        const meanY = d3.mean(numericRows, (row: any) => +row[cfg.yKey]);
        const base = { ...numericRows[0] };
        base[cfg.yKey] = meanY;
        return base;
      })
      .filter((row): row is any => row !== null)
      .sort(compareByX);
  }

  function buildSeries(arr: any[]): Array<{ key: string; values: any[] }> {
    if (!seriesField) {
      return [{ key: '__single__', values: aggregateSeriesValues(arr) }];
    }

    const grouped = d3.group(arr, (d: any) => getSeriesKey(d));
    return Array.from(grouped, ([key, values]) => ({
      key,
      values: aggregateSeriesValues(values),
    }));
  }

  function getSeriesColor(key: string): string {
    if (!seriesField) {
      return cfg.lineColor || DEFAULTS.lineColor;
    }

    return seriesColorScale(key);
  }

  // Preprocess and set scales are now moved to initialization, we only update scales here for resizing/updates
  function updateScales(arr: any[]) {
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
    const series = buildSeries(arr);
    const path = lineLayer.selectAll('path.line').data(series as any, (d: any) => d.key);

    // ENTER
    path.enter()
      .append('path')
      .attr('class', 'line')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => getSeriesColor(d.key))
      .attr('stroke-width', cfg.lineWidth || DEFAULTS.lineWidth)
      .attr('d', (d: any) => lineGen(d.values) as string)
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
      .attr('stroke', (d: any) => getSeriesColor(d.key))
      .attr('stroke-width', cfg.lineWidth || DEFAULTS.lineWidth)
      .transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(d3.easeCubicOut)
      .attr('d', (d: any) => lineGen(d.values) as string);

    // EXIT
    path.exit().remove();
  }

  function renderPoints(arr: any[]) {
    const series = buildSeries(arr);
    const show = !!cfg.showPoints;
    const pointRows = show
      ? series.flatMap((group) =>
          group.values
            .filter((d: any) => lineGen.defined()(d))
            .map((d: any) => ({ datum: d, key: group.key }))
        )
      : [];

    const sel = pointsLayer
      .selectAll('circle.point')
      .data(pointRows as any, (d: any) => `${d.key}::${String(d.datum[cfg.xKey])}::${String(d.datum[cfg.yKey])}`);

    // ENTER
    const entered = sel.enter()
      .append('circle')
      .attr('class', 'point')
      .attr('r', cfg.pointRadius || DEFAULTS.pointRadius)
      .attr('fill', (d: any) => getSeriesColor(d.key))
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.2)
      .attr('cx', (d: any) => {
        const xv = d.datum[cfg.xKey];
        if (currentXType === 'time') return coalesceNum((xScale as d3.ScaleTime<number, number>)(d.datum.__xDate as Date));
        if (currentXType === 'linear') return coalesceNum((xScale as d3.ScaleLinear<number, number>)(+xv));
        return coalesceNum((xScale as d3.ScalePoint<string>)(String(xv)) as number);
      })
      .attr('cy', (d: any) => coalesceNum((yScale as d3.ScaleLinear<number, number>)(+d.datum[cfg.yKey])))
      .on('mouseover', function () { d3.select(this).attr('fill', cfg.hoverColor || DEFAULTS.hoverColor); })
      .on('mouseout', function (_event: any, d: any) { d3.select(this).attr('fill', getSeriesColor(d.key)); });

    // UPDATE
    const merged = sel.merge(entered as any);
    merged.transition()
      .duration(cfg.animate ? (cfg.duration || DEFAULTS.duration) : 0)
      .ease(d3.easeCubicOut)
      .attr('r', cfg.pointRadius || DEFAULTS.pointRadius)
      .attr('fill', (d: any) => getSeriesColor(d.key))
      .attr('cx', (d: any) => {
        const xv = d.datum[cfg.xKey];
        if (currentXType === 'time') return coalesceNum((xScale as d3.ScaleTime<number, number>)(d.datum.__xDate as Date));
        if (currentXType === 'linear') return coalesceNum((xScale as d3.ScaleLinear<number, number>)(+xv));
        return coalesceNum((xScale as d3.ScalePoint<string>)(String(xv)) as number);
      })
      .attr('cy', (d: any) => coalesceNum((yScale as d3.ScaleLinear<number, number>)(+d.datum[cfg.yKey])));

    // EXIT
    sel.exit().remove();
  }

  function renderLegend(arr: any[]) {
    legendLayer.selectAll('*').remove();

    if (!seriesField || cfg.showLegend === false) {
      return;
    }

    const seriesKeys = Array.from(new Set(arr.map((d: any) => getSeriesKey(d))));
    if (seriesKeys.length <= 1) {
      return;
    }

    const legendItems = legendLayer
      .selectAll('g.legend-item')
      .data(seriesKeys)
      .enter()
      .append('g')
      .attr('class', 'legend-item')
      .attr('transform', (_d, i) => `translate(${i * 130}, 0)`);

    legendItems
      .append('line')
      .attr('x1', 0)
      .attr('x2', 20)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', (d) => getSeriesColor(d))
      .attr('stroke-width', Math.max(2, cfg.lineWidth || DEFAULTS.lineWidth));

    legendItems
      .append('text')
      .attr('x', 26)
      .attr('y', 4)
      .style('font-size', '11px')
      .style('fill', '#334155')
      .text((d) => d);

    const position = cfg.legendPosition ?? 'right';
    const itemHeight = 18;
    const itemWidth = 130;

    if (position === 'left' || position === 'right') {
      legendItems.attr('transform', (_d, i) => `translate(0, ${i * itemHeight})`);
    }

    if (position === 'top') {
      legendLayer.attr('transform', 'translate(0, 10)');
      return;
    }

    if (position === 'bottom') {
      const blockHeight = itemHeight;
      legendLayer.attr('transform', `translate(0, ${Math.max(10, innerHeight - blockHeight - 6)})`);
      return;
    }

    if (position === 'left') {
      legendLayer.attr('transform', 'translate(0, 10)');
      return;
    }

    // right
    legendLayer.attr('transform', `translate(${Math.max(0, innerWidth - itemWidth)}, 10)`);
  }

  function pointerHandlers(arr: any[]) {
    if (!enableTooltip) return;

    const formatX = currentXType === 'time' && timeFormatter
      ? (d: any) => timeFormatter!(d as Date)
      : (cfg.xTickFormat ? numFormatter(cfg.xTickFormat) : (d: any) => `${d}`);
    const formatY = cfg.yTickFormat ? numFormatter(cfg.yTickFormat) : (d: any) => `${d}`;

    const pointRows = buildSeries(arr).flatMap((group) =>
      group.values
        .filter((d: any) => lineGen.defined()(d))
        .map((d: any) => ({
          datum: d,
          key: group.key,
          x: (() => {
            const xv = d[cfg.xKey];
            if (currentXType === 'time') return coalesceNum((xScale as d3.ScaleTime<number, number>)(d.__xDate as Date));
            if (currentXType === 'linear') return coalesceNum((xScale as d3.ScaleLinear<number, number>)(+xv));
            return coalesceNum((xScale as d3.ScalePoint<string>)(String(xv)) as number);
          })(),
          y: coalesceNum((yScale as d3.ScaleLinear<number, number>)(+d[cfg.yKey])),
        }))
    );

    overlay
      .on('mousemove', function (event) {
        if (!tooltipEl) return;
        const [mx, my] = d3.pointer(event, this as any);

        let nearest: { datum: any; key: string; x: number; y: number } | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const point of pointRows) {
          const dx = mx - point.x;
          const dy = my - point.y;
          const distance = (dx * dx) + (dy * dy);
          if (distance < bestDistance) {
            bestDistance = distance;
            nearest = point;
          }
        }

        if (!nearest) return;
        // Place tooltip near cursor for better readability
        tooltipEl.style.left = `${margins.left + mx}px`;
        tooltipEl.style.top = `${margins.top + my}px`;
        const datum = nearest.datum;
        const xv = datum[cfg.xKey];
        const xLabel = currentXType === 'time' ? (datum.__xDate as Date) : xv;
        const seriesLabel = seriesField ? `<div><strong>${nearest.key}</strong></div>` : '';
        const fallback = `${seriesLabel}<div>${formatX(xLabel)}: ${formatY(+datum[cfg.yKey])}</div>`;
        tooltipEl.innerHTML = cfg.tooltipFormat ? cfg.tooltipFormat(datum) : fallback;
        tooltipEl.style.opacity = '1';
      })
      .on('mouseout', function () {
        if (!tooltipEl) return;
        tooltipEl.style.opacity = '0';
      });
  }

  function draw() {
    if (destroyed) return;
    const arr = preprocess(currentData);
    updateScales(arr);
    overlay.attr('width', innerWidth).attr('height', innerHeight);
    renderGrid();
    renderAxes();
    renderLine(arr);
    renderPoints(arr);
    renderLegend(arr);
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
