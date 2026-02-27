import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface DotDonutConfig {
    dotsCount?: number; // Total dots per ring, default 36
    activeColor?: string;
    inactiveColor?: string;
    textColor?: string;
    labelColor?: string;
    fontFamily?: string;
    gridColumns?: number; // Optional force columns, otherwise responsive
    minDonutSize?: number;
}

export function renderDotDonutChart(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, unknown>[],
    config: DotDonutConfig = {}
) {
    const dotsCount = config.dotsCount ?? 36;
    const activeColor = config.activeColor ?? spec.style?.palette?.[0] ?? '#2563eb';
    const inactiveColor = config.inactiveColor ?? '#cbd5e1'; // slate-300
    const textColor = config.textColor ?? '#0f172a';
    const labelColor = config.labelColor ?? '#475569';
    const fontFamily = spec.style?.fontFamily ?? 'Inter, sans-serif';
    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;

    // 1. Prepare Data
    const cleanData = data
        .map(d => {
            const val = Number(d[valueKey]);
            const cat = String(d[categoryKey]);
            return {
                category: cat,
                value: Number.isFinite(val) ? val : null,
            };
        })
        .filter(d => d.value !== null && d.value >= 0) as { category: string; value: number }[];

    const layout = spec.layout?.preset ?? 'grid';

    // 2. Setup SVG
    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const height = Number(svg.attr('height')) || 400;

    const titlePadding = 45;
    const availableHeight = spec.title ? height - titlePadding : height;
    const labelHeight = 35; // Space for the category text under the donut

    // 3. Layout Calculation
    const n = cleanData.length;
    let cols = 1;
    let rows = 1;
    let itemWidth = width;
    let rowHeight = availableHeight;

    if (layout === 'grid') {
        // Find optimal cols to maximize donut size while fitting n items in (width, availableHeight)
        let bestSize = 0;
        let bestCols = 1;

        for (let c = 1; c <= n; c++) {
            const r = Math.ceil(n / c);
            const cw = width / c;
            const ch = availableHeight / r;
            const size = Math.min(cw, ch - labelHeight);
            if (size > bestSize) {
                bestSize = size;
                bestCols = c;
            }
        }
        cols = bestCols;
        rows = Math.ceil(n / cols);
        itemWidth = width / cols;
        rowHeight = availableHeight / rows;
    } else if (layout === 'horizontal') {
        cols = n;
        rows = 1;
        itemWidth = width / n;
        rowHeight = availableHeight;
    } else if (layout === 'vertical') {
        cols = 1;
        rows = n;
        itemWidth = width;
        rowHeight = availableHeight / n;
    } else if (layout === 'circular') {
        cols = 1;
        rows = 1;
        itemWidth = width;
        rowHeight = availableHeight;
    }

    svg.selectAll('*').remove();

    // 4. Render
    // Render Title
    if (spec.title) {
        svg.selectAll('text.chart-title').remove();
        svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .style('fill', '#374151')
            .style('font-family', fontFamily)
            .text(spec.title);
    }

    const root = svg
        .append('g')
        .attr('class', 'chart-root')
        .attr('transform', spec.title ? `translate(0, ${titlePadding})` : '')
        .attr('font-family', fontFamily);

    const minDim = Math.min(width, availableHeight);
    // Circular layout specific constants
    const centerX = width / 2;
    const centerY = availableHeight / 2;
    // Reduce ring radius force if circular to ensure labels fit
    const ringRadiusForce = layout === 'circular'
        ? minDim * 0.32
        : minDim * 0.35;

    // Per-donut rendering
    cleanData.forEach((d, i) => {
        let cx, cy, currentItemWidth, currentItemHeight;

        if (layout === 'circular') {
            const angle = (i / n) * 2 * Math.PI - Math.PI / 2;
            cx = centerX + Math.cos(angle) * ringRadiusForce;
            cy = centerY + Math.sin(angle) * ringRadiusForce;
            currentItemWidth = (2 * Math.PI * ringRadiusForce) / n;
            currentItemHeight = currentItemWidth;
        } else {
            const colIndex = i % cols;
            const rowIndex = Math.floor(i / cols);
            cx = colIndex * itemWidth + itemWidth / 2;
            // Center the donut in the available cell height (rowHeight - labelHeight)
            const donutCellHeight = rowHeight - labelHeight;
            cy = rowIndex * rowHeight + donutCellHeight / 2;
            currentItemWidth = itemWidth;
            currentItemHeight = donutCellHeight;
        }

        // Donut geometry
        const padding = 20;
        const size = Math.min(currentItemWidth, currentItemHeight) - padding * 2;
        const radius = Math.max(20, size / 2);
        const dotRadius = radius * 0.08;
        const ringRadius = radius - dotRadius;

        const group = root.append('g')
            .attr('transform', `translate(${cx}, ${cy})`);

        // Calculate active dots
        const proportion = Math.min(Math.max(d.value, 0), 100) / 100;
        const activeDots = Math.round(proportion * dotsCount);

        // Draw dots
        const angleStep = (2 * Math.PI) / dotsCount;
        const startAngle = -Math.PI / 2;

        for (let dotIdx = 0; dotIdx < dotsCount; dotIdx++) {
            const angle = startAngle + dotIdx * angleStep;
            const dx = Math.cos(angle) * ringRadius;
            const dy = Math.sin(angle) * ringRadius;
            const isActive = dotIdx < activeDots;

            group.append('circle')
                .attr('cx', dx)
                .attr('cy', dy)
                .attr('r', dotRadius)
                .attr('fill', isActive ? activeColor : inactiveColor)
                .attr('opacity', isActive ? 1 : 0.6);
        }

        // Center Value
        group.append('text')
            .text(`${d.value}%`)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.3em')
            .attr('font-size', `${Math.max(10, radius * 0.4)}px`)
            .attr('font-weight', 'bold')
            .attr('fill', textColor);

        // Category Label
        group.append('text')
            .text(d.category)
            .attr('text-anchor', 'middle')
            .attr('y', ringRadius + dotRadius * 2 + 24) // Increased spacing
            .attr('font-size', '11px') // Slightly smaller font for better fit
            .attr('font-weight', '500')
            .attr('fill', labelColor)
            .style('pointer-events', 'none')
            .each(function () {
                // Wrap text if it exceeds currentItemWidth
                const self = d3.select(this);
                const text = d.category;
                const words = text.split(/\s+/).reverse();
                let word;
                let line: string[] = [];
                let lineNumber = 0;
                const lineHeight = 1.1; // ems
                const y = self.attr("y");
                const dy = 0;
                let tspan = self.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", dy + "em");
                while (word = words.pop()) {
                    line.push(word);
                    tspan.text(line.join(" "));
                    if ((tspan.node()?.getComputedTextLength() ?? 0) > currentItemWidth - 10) {
                        line.pop();
                        tspan.text(line.join(" "));
                        line = [word];
                        tspan = self.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + dy + "em").text(word);
                    }
                }
            });
    });
}
