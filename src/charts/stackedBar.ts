import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface StackedBarConfig {
    animationDuration?: number;
    showTooltip?: boolean;
    showLegend?: boolean;
    barPadding?: number;
    cornerRadius?: number;
}

export function renderStackedBarChart(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, any>[],
    config: StackedBarConfig = {}
) {
    const {
        animationDuration = 1000,
        showTooltip = true,
        showLegend = true,
        barPadding = 0.2,
        cornerRadius = 4
    } = config;

    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;
    const seriesKey = spec.encoding.series?.field;

    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const height = Number(svg.attr('height')) || 450;
    const margin = { top: 40, right: 150, bottom: 50, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 1. Prepare Data (Long to Wide for d3.stack)
    const seriesSet = new Set<string>();
    const categories = Array.from(new Set(data.map(d => String(d[categoryKey]))));

    const pivoted: any[] = categories.map(cat => {
        const row: any = { [categoryKey]: cat };
        const catData = data.filter(d => String(d[categoryKey]) === cat);
        catData.forEach(d => {
            const seriesVal = seriesKey ? String(d[seriesKey]) : 'Value';
            seriesSet.add(seriesVal);
            row[seriesVal] = (row[seriesVal] || 0) + Number(d[valueKey]);
        });
        return row;
    });

    const subgroups = Array.from(seriesSet);

    // 2. Stack Generator
    const stack = d3.stack()
        .keys(subgroups);

    const stackedData = stack(pivoted);

    // 3. Scales
    const x = d3.scaleBand()
        .domain(categories)
        .range([0, innerWidth])
        .padding(barPadding);

    const y = d3.scaleLinear()
        .domain([0, d3.max(pivoted, d => subgroups.reduce((sum, key) => sum + (d[key] || 0), 0)) || 0])
        .nice()
        .range([innerHeight, 0]);

    const palette = spec.style?.palette ?? d3.schemeTableau10;
    const color = d3.scaleOrdinal<string>()
        .domain(subgroups)
        .range(palette);

    // 4. Axes
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    // 5. Tooltip
    let tooltip: any;
    if (showTooltip) {
        tooltip = d3.select("body").selectAll(".chart-tooltip").data([0]);
        tooltip = tooltip.enter()
            .append("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("background", "white")
            .style("padding", "8px 12px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "6px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("opacity", 0)
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)")
            .merge(tooltip);
    }

    // 6. Bars
    const layer = g.selectAll(".layer")
        .data(stackedData)
        .join("g")
        .attr("class", "layer")
        .attr("fill", d => color(d.key));

    const bars = layer.selectAll("rect")
        .data(d => d.map(v => ({ ...v, key: d.key })))
        .join("rect")
        .attr("x", (d: any) => x(d.data[categoryKey]) || 0)
        .attr("width", x.bandwidth())
        .attr("y", innerHeight)
        .attr("height", 0)
        .attr("rx", cornerRadius);

    if (showTooltip) {
        bars.on("mouseover", function (event, d: any) {
            tooltip
                .style("opacity", 1)
                .html(`<strong>${d.key}</strong><br>${categoryKey}: ${d.data[categoryKey]}<br>Value: ${fmt(d[1] - d[0])}`)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                tooltip.style("opacity", 0);
            });
    }

    bars.transition()
        .duration(animationDuration)
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]));

    // 7. Legend
    if (showLegend) {
        const legend = g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${innerWidth + 20}, 0)`);

        subgroups.forEach((key, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

            row.append("rect")
                .attr("width", 15)
                .attr("height", 15)
                .attr("fill", color(key))
                .attr("rx", 2);

            row.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .style("font-size", "12px")
                .text(key);
        });
    }

    const fmt = d3.format(",.2~f");

    // Expose update function
    (svgEl as any).updateChart = function (newData: any[]) {
        const categories = Array.from(new Set(newData.map(d => String(d[categoryKey]))));
        const updatedPivoted: any[] = categories.map(cat => {
            const row: any = { [categoryKey]: cat };
            const catData = newData.filter(d => String(d[categoryKey]) === cat);
            catData.forEach(d => {
                const seriesVal = seriesKey ? String(d[seriesKey]) : 'Value';
                row[seriesVal] = (row[seriesVal] || 0) + Number(d[valueKey]);
            });
            return row;
        });

        const updatedStacked = stack(updatedPivoted);

        y.domain([0, d3.max(updatedPivoted, d => subgroups.reduce((sum, key) => sum + (d[key] || 0), 0)) || 0]).nice();

        g.select(".axis--y").transition().duration(animationDuration).call(d3.axisLeft(y) as any);

        const updatedLayers = g.selectAll(".layer")
            .data(updatedStacked);

        updatedLayers.selectAll("rect")
            .data((d: any) => d.map((v: any) => ({ ...v, key: d.key })))
            .transition()
            .duration(animationDuration)
            .attr("y", (d: any) => y(d[1]))
            .attr("height", (d: any) => y(d[0]) - y(d[1]));
    };
}
