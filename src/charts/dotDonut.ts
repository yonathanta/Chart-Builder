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

    // 2. Setup SVG
    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    // const height = Number(svg.attr('height')) || 600; // Unused for now in grid flow, but kept in mind

    svg.selectAll('*').remove();

    // 3. Grid Layout Calculation
    const n = cleanData.length;
    // Compute optimal columns/rows to fit 
    // Naive approach: compute columns based on minWidth
    let cols = Math.floor(width / minDonutSize);
    if (cols < 1) cols = 1;
    if (cols > n) cols = n; // Don't have more columns than items

    // Responsive grid centering
    // const rows = Math.ceil(n / cols);
    const itemWidth = width / cols;
    const rowHeight = itemWidth; // square tiles often look best for donuts

    // 4. Render
    const root = svg
        .append('g')
        .attr('class', 'chart-root')
        .attr('font-family', fontFamily);

    // Per-donut rendering
    cleanData.forEach((d, i) => {
        const colIndex = i % cols;
        const rowIndex = Math.floor(i / cols);
        const x = colIndex * itemWidth;
        const y = rowIndex * rowHeight;
        const cx = x + itemWidth / 2;
        const cy = y + rowHeight / 2;

        // Donut geometry
        // fit within itemWidth with some padding
        const padding = 20;
        const size = Math.min(itemWidth, rowHeight) - padding * 2;
        const radius = size / 2;
        // Dot settings
        const dotRadius = radius * 0.08; // responsive dot size
        const ringRadius = radius - dotRadius; // active path radius

        const group = root.append('g')
            .attr('transform', `translate(${cx}, ${cy})`);

        // Calculate active dots
        // Input is assumed 0-100 percentage usually. 
        // If > 100, we clamp or wrap? Requirement says "value / 100 * totalDots".
        // If value is fraction (0.5 = 50%), user needs to normalize? 
        // "Each category has one numeric proportion value (0–100)" -> Assume 0-100 scale.
        const proportion = Math.min(Math.max(d.value, 0), 100) / 100;
        const activeDots = Math.round(proportion * dotsCount);

        // Draw dots
        const angleStep = (2 * Math.PI) / dotsCount;
        // Start from top (-PI/2)
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
                .attr('opacity', isActive ? 1 : 0.6); // slight fade for inactive if desired, or solid
        }

        // Center Value
        group.append('text')
            .text(`${d.value}%`)
            .attr('text-anchor', 'middle')
            .attr('dy', '0.1em') // optical center
            .attr('font-size', `${Math.max(12, radius * 0.4)}px`)
            .attr('font-weight', 'bold')
            .attr('fill', textColor);

        // Category Label (below donut)
        group.append('text')
            .text(d.category)
            .attr('text-anchor', 'middle')
            .attr('y', ringRadius + dotRadius * 2 + 16)
            .attr('font-size', '14px')
            .attr('fill', labelColor)
            .style('max-width', `${itemWidth}px`); // Note: SVG text wrapping not auto, but short labels assumed
    });
}
