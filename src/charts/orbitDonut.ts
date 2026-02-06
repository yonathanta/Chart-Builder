// 1. Prepare Data
import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface OrbitDonutConfig {
    centerColor?: string;
    orbitColors?: string[];
    textColor?: string;
    labelColor?: string;
    fontFamily?: string;
    layout?: 'horizontal' | 'vertical' | 'circular' | 'grid';
}

export function renderOrbitDonutChart(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, unknown>[],
    config: OrbitDonutConfig = {}
) {
    const textColor = config.textColor ?? '#111';
    const labelColor = config.labelColor ?? '#555';
    const fontFamily = spec.style?.fontFamily ?? 'Segoe UI, Tahoma, Geneva, Verdana, sans-serif';
    const defaultPalette = spec.style?.palette ?? ['#2563eb', '#16a34a', '#f59e0b', '#e11d48', '#0ea5e9', '#9333ea', '#f97316'];
    const layout = spec.layout?.preset ?? config.layout ?? 'horizontal'; // Standardized to use spec layout preset


    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;

    // 1. Prepare Data
    // We expect the first row to be the center, others to be satellites
    const cleanData = data
        .map((d, i) => {
            const val = Number(d[valueKey]);
            const cat = String(d[categoryKey]);
            return {
                name: cat,
                value: Number.isFinite(val) ? val : 0,
                color: defaultPalette[i % defaultPalette.length],
                center: i === 0, // First item is center
                index: i
            };
        });

    if (cleanData.length === 0) return;

    // 2. Setup SVG
    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const requestedHeight = Number(svg.attr('height')) || 420;

    // Calculate dynamic height
    const count = cleanData.length;
    let totalHeight = requestedHeight;

    if (layout === 'vertical') {
        totalHeight = Math.max(requestedHeight, count * 200);
    } else if (layout === 'grid') {
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        totalHeight = Math.max(requestedHeight, rows * 200);
    } else if (layout === 'circular') {
        totalHeight = Math.max(requestedHeight, width); // Square-ish for circular
    }

    svg.attr('height', totalHeight);
    svg.selectAll('*').remove();

    const cx = width / 2;
    const cy = totalHeight / 2;
    const minDim = Math.min(width, totalHeight);

    // 3. Layout Calculation
    if (layout === 'circular') {
        const centerRadius = minDim * 0.15;
        const orbitRadius = minDim * 0.10;
        const orbitDistance = minDim * 0.32; // Slightly reduced to fit labels

        const satellites = cleanData.filter(d => !d.center);
        const centerItem = cleanData.find(d => d.center);

        if (centerItem) {
            (centerItem as any).cx = cx;
            (centerItem as any).cy = cy;
            (centerItem as any).r = centerRadius;
        }

        satellites.forEach((d, i) => {
            const angle = (i / satellites.length) * 2 * Math.PI - Math.PI / 2;
            (d as any).cx = cx + Math.cos(angle) * orbitDistance;
            (d as any).cy = cy + Math.sin(angle) * orbitDistance;
            (d as any).r = orbitRadius;
        });
    } else if (layout === 'horizontal') {
        const padding = 40;
        const availableW = width - (padding * 2);
        const spacing = availableW / count;
        const r = Math.min((spacing * 0.8) / 2, (totalHeight * 0.5) / 2);

        cleanData.forEach((d, i) => {
            (d as any).cx = padding + (i * spacing) + (spacing / 2);
            (d as any).cy = cy - 20;
            (d as any).r = r;
        });
    } else if (layout === 'vertical') {
        const padding = 40;
        const availableH = totalHeight - (padding * 2);
        const spacing = availableH / count;
        const r = Math.min((spacing * 0.7) / 2, (width * 0.6) / 2);

        cleanData.forEach((d, i) => {
            (d as any).cx = cx;
            (d as any).cy = padding + (i * spacing) + (spacing / 2);
            (d as any).r = r;
        });
    } else if (layout === 'grid') {
        const cols = Math.ceil(Math.sqrt(count));
        const rows = Math.ceil(count / cols);
        const cellW = width / cols;
        const cellH = totalHeight / rows;
        const r = Math.min(cellW, cellH) * 0.3;

        cleanData.forEach((d, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            (d as any).cx = (col * cellW) + (cellW / 2);
            (d as any).cy = (row * cellH) + (cellH / 2) - 10;
            (d as any).r = r;
        });
    }

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

    const root = svg.append('g')
        .attr('class', 'chart-root')
        .attr('transform', spec.title ? `translate(0, 40)` : '')
        .attr('font-family', fontFamily);

    // 4. Arc Generators
    const getArc = (d: any, endAngle: number) => {
        return d3.arc()
            .innerRadius(Math.max(10, d.r * 0.65))
            .outerRadius(Math.max(15, d.r))
            .startAngle(0)
            .endAngle(endAngle)
            .context(null)(d);
    };

    // 5. Render Groups
    const groups = root.selectAll('g.donut')
        .data(cleanData)
        .join('g')
        .attr('class', 'donut')
        .attr('transform', (d: any) => `translate(${d.cx}, ${d.cy})`);

    groups.append('path')
        .attr('d', (d: any) => getArc(d, 2 * Math.PI))
        .attr('fill', '#eeeeee');

    groups.append('path')
        .attr('fill', (d: any) => d.color)
        .transition()
        .duration(1200)
        .ease(d3.easeCubicOut)
        .attrTween('d', function (d: any) {
            const targetAngle = (d.value / 100) * 2 * Math.PI;
            const interpolate = d3.interpolate(0, targetAngle);
            return function (t: number) {
                return getArc(d, interpolate(t)) || "";
            };
        });

    // 6. Labels
    groups.append('text')
        .attr('class', 'value')
        .attr('text-anchor', 'middle')
        .attr('dy', '0.35em')
        .attr('font-weight', 'bold')
        .attr('fill', textColor)
        .attr('font-size', (d: any) => `${Math.max(10, d.r * 0.4)}px`)
        .text((d: any) => `${d.value}%`);

    groups.append('text')
        .attr('class', 'label')
        .attr('text-anchor', 'middle')
        .attr('y', (d: any) => d.r + 24)
        .attr('fill', labelColor)
        .attr('font-weight', '500')
        .attr('font-size', '11px')
        .text((d: any) => d.name)
        .each(function (d: any) {
            const self = d3.select(this);
            const text = d.name;
            const maxWidth = d.r * 2.5;
            const words = text.split(/\s+/).reverse();
            let word;
            let line: string[] = [];
            let lineNumber = 0;
            const lineHeight = 1.1;
            const y = self.attr("y");
            let tspan = self.text(null).append("tspan").attr("x", 0).attr("y", y).attr("dy", "0em");
            while (word = words.pop()) {
                line.push(word);
                tspan.text(line.join(" "));
                if ((tspan.node()?.getComputedTextLength() ?? 0) > maxWidth && line.length > 1) {
                    line.pop();
                    tspan.text(line.join(" "));
                    line = [word];
                    tspan = self.append("tspan").attr("x", 0).attr("y", y).attr("dy", ++lineNumber * lineHeight + "em").text(word);
                }
            }
        });
}
