import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface PieConfig {
    innerRadius?: number; // 0 for pie, > 0 for donut
    outerRadiusOffset?: number; // slice expansion on hover
    animationDuration?: number;
    showLabels?: boolean;
    showTooltip?: boolean;
}

export function renderPieDonutChart(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, unknown>[],
    config: PieConfig = {}
) {
    const {
        innerRadius = 0,
        outerRadiusOffset = 15,
        animationDuration = 800,
        showLabels = true,
        showTooltip = true
    } = config;

    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;

    // 1. Prepare Data
    const cleanData = data
        .map(d => ({
            label: String(d[categoryKey]),
            value: Number(d[valueKey])
        }))
        .filter(d => Number.isFinite(d.value) && d.value > 0);

    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 500;
    const height = Number(svg.attr('height')) || 400;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };

    const radius = Math.min(width, height) / 2 - Math.max(margin.left, margin.right);

    // Clear previous
    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${width / 2},${height / 2})`);

    // Color scale
    const palette = spec.style?.palette ?? d3.schemeTableau10;
    const color = d3.scaleOrdinal<string>()
        .domain(cleanData.map(d => d.label))
        .range(palette);

    // Pie layout
    const pie = d3.pie<any>()
        .sort(null)
        .value(d => d.value);

    // Arc generators
    const arc = d3.arc<any>()
        .innerRadius(innerRadius)
        .outerRadius(radius);

    const arcHover = d3.arc<any>()
        .innerRadius(innerRadius)
        .outerRadius(radius + outerRadiusOffset);

    // Draw slices
    const slices = g.selectAll("path")
        .data(pie(cleanData))
        .enter()
        .append("path")
        .attr("fill", d => color(d.data.label))
        .attr("stroke", "#fff")
        .attr("stroke-width", 2)
        .each(function (this: any) {
            this._current = { startAngle: 0, endAngle: 0 };
        });

    // Animation entry
    slices.transition()
        .duration(animationDuration)
        .attrTween("d", function (this: any, d: any) {
            const interpolate = d3.interpolate(this._current, d);
            this._current = interpolate(1);
            return (t: number) => arc(interpolate(t)) as string;
        });

    // Interaction
    if (showTooltip) {
        slices.on("mouseover", function (this: any, event: any, d: any) {
            d3.select(this).transition().duration(200).attr("d", arcHover);

            // Simple overlay tooltip logic if needed, but for now we focus on the expansion
            // The template uses a body-appended div. We'll skip that for now to avoid side effects
            // and maybe use the SVG title for native tooltips if needed.
            d3.select(this).append("title").text(`${d.data.label}: ${d.data.value}`);
        })
            .on("mouseout", function (this: any) {
                d3.select(this).transition().duration(200).attr("d", arc);
                d3.select(this).select("title").remove();
            });
    }

    // Labels
    if (showLabels) {
        const labelArc = d3.arc<any>()
            .innerRadius(radius * 0.6)
            .outerRadius(radius * 0.6);

        g.selectAll("text.pie-label")
            .data(pie(cleanData))
            .enter()
            .append("text")
            .attr("class", "pie-label")
            .attr("dy", "0.35em")
            .attr("fill", "#fff")
            .attr("font-size", "12px")
            .attr("font-weight", "500")
            .attr("text-anchor", "middle")
            .style("pointer-events", "none")
            .style("opacity", 0)
            .transition()
            .delay(animationDuration * 0.8)
            .duration(400)
            .style("opacity", 1)
            .attr("transform", d => `translate(${labelArc.centroid(d)})`)
            .text(d => d.data.label);
    }

    // Title
    if (spec.title) {
        g.append("text")
            .attr("text-anchor", "middle")
            .attr("y", -height / 2 + 20)
            .attr("font-size", "16px")
            .attr("font-weight", "600")
            .attr("fill", "#1e293b")
            .text(spec.title);
    }
}
