import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface StackedBarConfig {
    animationDuration?: number;
    showTooltip?: boolean;
    showLegend?: boolean;
    showValues?: boolean;
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
        showValues = false,
        barPadding = 0.2,
        cornerRadius = 4
    } = config;

    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;
    const seriesKey = spec.encoding.series?.field;

    const fmt = d3.format(",.2~f");

    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const height = Number(svg.attr('height')) || 450;

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

    // Calculate series totals for legend
    const seriesTotals: Record<string, number> = {};
    subgroups.forEach(key => {
        seriesTotals[key] = pivoted.reduce((sum, row) => sum + (row[key] || 0), 0);
    });

    // 2. Stack Generator
    const stack = d3.stack()
        .keys(subgroups);

    const stackedData = stack(pivoted);

    const x = d3.scaleBand()
        .domain(categories)
        .range([0, 100]) // temporary range
        .padding(barPadding);

    const y = d3.scaleLinear()
        .domain([0, d3.max(pivoted, d => subgroups.reduce((sum, key) => sum + (d[key] || 0), 0)) || 0])
        .nice()
        .range([100, 0]); // temporary range

    const palette = spec.style?.palette ?? d3.schemeTableau10;
    const color = d3.scaleOrdinal<string>()
        .domain(subgroups)
        .range(palette);

    // 4. Dynamic Margins calculation
    const tempSvg = svg.append('svg').style('visibility', 'hidden').style('position', 'absolute');
    const tempText = tempSvg.append('text').style('font-size', '10px').style('font-family', 'sans-serif');

    // Left margin based on Y-axis labels
    let maxYLabelWidth = 0;
    const yTicks = y.ticks();
    yTicks.forEach(tick => {
        tempText.text(tick);
        const bbox = (tempText.node() as SVGTextElement).getBBox();
        if (bbox.width > maxYLabelWidth) maxYLabelWidth = bbox.width;
    });
    const dynamicMarginLeft = Math.max(60, maxYLabelWidth + 20);

    // Right margin based on Legend or right-most X-axis label
    let dynamicMarginRight = 30;
    if (showLegend && subgroups.length > 0) {
        let maxLegendWidth = 0;
        tempText.style('font-size', '12px');
        subgroups.forEach(key => {
            const legendText = `${key} (${fmt(seriesTotals[key] || 0)})`;
            tempText.text(legendText);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            if (bbox.width > maxLegendWidth) maxLegendWidth = bbox.width;
        });
        dynamicMarginRight = Math.max(150, 20 + 15 + maxLegendWidth + 20);
    } else {
        const lastXDomain = categories[categories.length - 1];
        let maxXLabelWidth = 0;
        if (lastXDomain !== undefined) {
            tempText.text(String(lastXDomain));
            maxXLabelWidth = (tempText.node() as SVGTextElement).getBBox().width;
        }
        dynamicMarginRight = Math.max(30, maxXLabelWidth / 2 + 10);
    }

    tempSvg.remove();

    const margin = { top: spec.title ? 65 : 40, right: dynamicMarginRight, bottom: 50, left: dynamicMarginLeft };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Render Title
    if (spec.title) {
        svg.append('text')
            .attr('class', 'chart-title')
            .attr('x', width / 2)
            .attr('y', 25)
            .attr('text-anchor', 'middle')
            .style('font-size', '18px')
            .style('font-weight', 'bold')
            .style('fill', '#374151')
            .text(spec.title);
    }

    // Update ranges with actual inner dimensions
    x.range([0, innerWidth]);
    y.range([innerHeight, 0]);

    svg.selectAll("*").remove();

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // 5. Axes
    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .attr("class", "axis--y")
        .call(d3.axisLeft(y));

    // 6. Tooltip
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

    // 7. Bars
    const layerGroups = g.selectAll(".layer-group")
        .data(stackedData)
        .join("g")
        .attr("class", "layer-group")
        .attr("fill", d => color(d.key));

    const bars = layerGroups.selectAll("rect.bar")
        .data(d => d.map(v => ({ ...v, key: d.key })))
        .join("rect")
        .attr("class", "bar")
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
        .attr("y", (d: any) => y(d[1]))
        .attr("height", (d: any) => y(d[0]) - y(d[1]));

    // 7.5 Data Labels (Values)
    if (showValues) {
        layerGroups.selectAll("text.bar-label")
            .data(d => d.map(v => ({ ...v, key: d.key })))
            .join("text")
            .attr("class", "bar-label")
            .attr("x", (d: any) => (x(d.data[categoryKey]) || 0) + x.bandwidth() / 2)
            .attr("y", (d: any) => y((d[0] + d[1]) / 2))
            .attr("dy", "0.35em")
            .attr("text-anchor", "middle")
            .style("font-size", "10px")
            .style("fill", "#fff") // White text or dynamic
            .style("pointer-events", "none")
            .style("opacity", 0)
            .text((d: any) => {
                const val = d[1] - d[0];
                return val > 0 ? fmt(val) : '';
            })
            .transition()
            .duration(animationDuration)
            .style("opacity", 1);
    }

    // 8. Legend
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
                .text(`${key} (${fmt(seriesTotals[key] || 0)})`);
        });
    }

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

        const updatedLayers = g.selectAll(".layer-group")
            .data(updatedStacked);

        updatedLayers.selectAll("rect.bar")
            .data((d: any) => d.map((v: any) => ({ ...v, key: d.key })))
            .transition()
            .duration(animationDuration)
            .attr("y", (d: any) => y(d[1]))
            .attr("height", (d: any) => y(d[0]) - y(d[1]));

        if (showValues) {
            updatedLayers.selectAll("text.bar-label")
                .data((d: any) => d.map((v: any) => ({ ...v, key: d.key })))
                .transition()
                .duration(animationDuration)
                .attr("y", (d: any) => y((d[0] + d[1]) / 2))
                .text((d: any) => {
                    const val = d[1] - d[0];
                    return val > 0 ? fmt(val) : '';
                });
        }
    };
}
