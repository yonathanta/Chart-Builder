import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface ScatterConfig {
    animationDuration?: number;
    showTooltip?: boolean;
    showLegend?: boolean;
    pointRadius?: number;
    showGridlines?: boolean;
}

export function renderScatterPlot(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, any>[],
    config: ScatterConfig = {}
) {
    const {
        animationDuration = 1000,
        showTooltip = true,
        showLegend = true,
        pointRadius = 5,
        showGridlines = true
    } = config;

    const xKey = spec.encoding.x?.field ?? spec.encoding.category.field;
    const yKey = spec.encoding.y?.field ?? spec.encoding.value.field;
    const seriesKey = spec.encoding.series?.field;
    const sizeKey = spec.encoding.size?.field;

    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const height = Number(svg.attr('height')) || 450;

    // 1. Prepare Data
    const cleanData = data.filter(d =>
        d[xKey] !== undefined && d[xKey] !== null &&
        d[yKey] !== undefined && d[yKey] !== null
    );

    const seriesSet = new Set<string>();
    cleanData.forEach(d => {
        if (seriesKey) seriesSet.add(String(d[seriesKey]));
        else seriesSet.add('All');
    });
    const seriesList = Array.from(seriesSet);

    // 2. Scales
    const xExtent = d3.extent(cleanData, d => Number(d[xKey])) as [number, number];
    const yExtent = d3.extent(cleanData, d => Number(d[yKey])) as [number, number];

    // Add some padding to extents
    const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
    const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

    const x = d3.scaleLinear()
        .domain([xExtent[0] - xPadding, xExtent[1] + xPadding])
        .nice()
        .range([0, 100]); // Temporary range

    const y = d3.scaleLinear()
        .domain([yExtent[0] - yPadding, yExtent[1] + yPadding])
        .nice()
        .range([100, 0]); // Temporary range

    const r = d3.scaleSqrt()
        .domain(d3.extent(cleanData, d => sizeKey ? Number(d[sizeKey]) || 0 : 0) as [number, number])
        .range(sizeKey ? [2, 30] : [pointRadius, pointRadius]);

    const palette = spec.style?.palette ?? d3.schemeTableau10;
    const color = d3.scaleOrdinal<string>()
        .domain(seriesList)
        .range(palette);

    // 3. Dynamic Margins calculation
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
    if (showLegend && seriesKey) {
        let maxLegendWidth = 0;
        tempText.style('font-size', '12px');
        seriesList.forEach(key => {
            tempText.text(key);
            const bbox = (tempText.node() as SVGTextElement).getBBox();
            if (bbox.width > maxLegendWidth) maxLegendWidth = bbox.width;
        });
        // 20px padding + 15px color box + max text width
        dynamicMarginRight = Math.max(150, 20 + 15 + maxLegendWidth + 20);
    } else {
        // Just check right-most tick just in case
        let maxXLabelWidth = 0;
        const xTicks = x.ticks();
        if (xTicks.length > 0) {
            tempText.text(String(xTicks[xTicks.length - 1]));
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

    // 3. Axes & Grid
    if (showGridlines) {
        g.append("g")
            .attr("class", "grid x-grid")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(() => ""))
            .selectAll("line")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-dasharray", "2,2");

        g.append("g")
            .attr("class", "grid y-grid")
            .call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => ""))
            .selectAll("line")
            .attr("stroke", "#e2e8f0")
            .attr("stroke-dasharray", "2,2");
    }

    g.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    g.append("g")
        .call(d3.axisLeft(y));

    // 4. Points
    const points = g.selectAll(".point")
        .data(cleanData)
        .join("circle")
        .attr("class", "point")
        .attr("cx", d => x(Number(d[xKey])))
        .attr("cy", d => y(Number(d[yKey])))
        .attr("r", 0)
        .attr("fill", d => color(seriesKey ? String(d[seriesKey]) : 'All'))
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .attr("opacity", 0.7);

    points.transition()
        .duration(animationDuration)
        .attr("r", d => r(sizeKey ? Number(d[sizeKey]) || 0 : 0));

    // 5. Tooltip
    if (showTooltip) {
        const tooltip = d3.select("body").selectAll(".chart-tooltip").data([0]).join("div")
            .attr("class", "chart-tooltip")
            .style("position", "absolute")
            .style("background", "white")
            .style("padding", "8px 12px")
            .style("border", "1px solid #ccc")
            .style("border-radius", "6px")
            .style("pointer-events", "none")
            .style("font-size", "12px")
            .style("opacity", 0)
            .style("box-shadow", "0 2px 4px rgba(0,0,0,0.1)");

        points.on("mouseover", function (event, d: any) {
            d3.select(this).attr("opacity", 1).attr("stroke", "#000").attr("stroke-width", 2);
            tooltip
                .style("opacity", 1)
                .html(`
                    <strong>${seriesKey ? d[seriesKey] : 'Point'}</strong><br>
                    ${xKey}: ${d[xKey]}<br>
                    ${yKey}: ${d[yKey]}
                    ${sizeKey ? `<br>${sizeKey}: ${d[sizeKey]}` : ''}
                `)
                .style("left", (event.pageX + 15) + "px")
                .style("top", (event.pageY - 28) + "px");
        })
            .on("mousemove", function (event) {
                tooltip
                    .style("left", (event.pageX + 15) + "px")
                    .style("top", (event.pageY - 28) + "px");
            })
            .on("mouseout", function () {
                d3.select(this).attr("opacity", 0.7).attr("stroke", "#fff").attr("stroke-width", 1);
                tooltip.style("opacity", 0);
            });
    }

    // 6. Legend
    if (showLegend && seriesKey) {
        const legend = g.append("g")
            .attr("class", "legend")
            .attr("transform", `translate(${innerWidth + 20}, 0)`);

        seriesList.forEach((key, i) => {
            const row = legend.append("g")
                .attr("transform", `translate(0, ${i * 20})`);

            row.append("circle")
                .attr("cx", 7.5)
                .attr("cy", 7.5)
                .attr("r", 5)
                .attr("fill", color(key));

            row.append("text")
                .attr("x", 20)
                .attr("y", 12)
                .style("font-size", "12px")
                .text(key);
        });
    }

    // Expose update function
    (svgEl as any).updateChart = function (newData: Record<string, any>[]) {
        const updatedCleanData = newData.filter(d =>
            d[xKey] !== undefined && d[xKey] !== null &&
            d[yKey] !== undefined && d[yKey] !== null
        );

        const xExtent = d3.extent(updatedCleanData, d => Number(d[xKey])) as [number, number];
        const yExtent = d3.extent(updatedCleanData, d => Number(d[yKey])) as [number, number];
        const xPadding = (xExtent[1] - xExtent[0]) * 0.05 || 1;
        const yPadding = (yExtent[1] - yExtent[0]) * 0.05 || 1;

        x.domain([xExtent[0] - xPadding, xExtent[1] + xPadding]).nice();
        y.domain([yExtent[0] - yPadding, yExtent[1] + yPadding]).nice();

        g.select(".x-grid").transition().duration(animationDuration).call(d3.axisBottom(x).tickSize(-innerHeight).tickFormat(() => "") as any);
        g.select(".y-grid").transition().duration(animationDuration).call(d3.axisLeft(y).tickSize(-innerWidth).tickFormat(() => "") as any);

        const updatedPoints = g.selectAll(".point")
            .data(updatedCleanData);

        updatedPoints.exit().remove();

        updatedPoints.enter()
            .append("circle")
            .attr("class", "point")
            .attr("cx", d => x(Number(d[xKey])))
            .attr("cy", d => y(Number(d[yKey])))
            .attr("r", 0)
            .attr("fill", d => color(seriesKey ? String(d[seriesKey]) : 'All'))
            .attr("stroke", "#fff")
            .attr("stroke-width", 1)
            .attr("opacity", 0.7)
            .merge(updatedPoints as any)
            .transition()
            .duration(animationDuration)
            .attr("cx", (d: any) => x(Number(d[xKey])))
            .attr("cy", (d: any) => y(Number(d[yKey])))
            .attr("r", (d: any) => r(sizeKey ? Number(d[sizeKey]) || 0 : 0));
    };
}
