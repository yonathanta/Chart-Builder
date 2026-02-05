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
    const minDonutSize = config.minDonutSize ?? 160;

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

    // 3. Layout Calculation
    const n = cleanData.length;
    let cols = 1;
    let rows = 1;
    let itemWidth = width;
    let rowHeight = height;

    if (layout === 'grid') {
        cols = Math.floor(width / minDonutSize);
        if (cols < 1) cols = 1;
        if (cols > n) cols = n;
        rows = Math.ceil(n / cols);
        itemWidth = width / cols;
        rowHeight = itemWidth;
    } else if (layout === 'horizontal') {
        cols = n;
        rows = 1;
        itemWidth = width / n;
        rowHeight = Math.min(height, itemWidth);
    } else if (layout === 'vertical') {
        cols = 1;
        rows = n;
        itemWidth = width;
        rowHeight = Math.min(height / n, minDonutSize);
    } else if (layout === 'circular') {
        cols = 1;
        rows = 1;
    }

    const labelHeight = 40;
    // Calculate dynamic height
    let totalHeight = height;
    if (layout === 'vertical') {
        totalHeight = Math.max(height, n * 200);
    } else if (layout === 'grid') {
        const gridCols = Math.floor(width / minDonutSize) || 1;
        const gridRows = Math.ceil(n / gridCols);
        totalHeight = Math.max(height, gridRows * 200);
    } else if (layout === 'circular') {
        totalHeight = Math.max(height, width); // Square-ish for circular
    }

    svg.attr('height', totalHeight);
    // Clear any previous drawing so the selected chart renders alone
    svg.selectAll('*').remove();

    // 4. Render
    const root = svg
        .append('g')
        .attr('class', 'chart-root')
        .attr('font-family', fontFamily);

    const minDim = Math.min(width, totalHeight);
    // Circular layout specific constants
    const centerX = width / 2;
    const centerY = totalHeight / 2;
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
            cy = rowIndex * (rowHeight + labelHeight) + rowHeight / 2 + 20; // Added offset for top padding
            currentItemWidth = itemWidth;
            currentItemHeight = rowHeight;
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
