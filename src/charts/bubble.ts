import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface BubbleChartConfig {
    textColor?: string;
    topColor?: string;
    bottomColor?: string;
    middleColor?: string;
    fontFamily?: string;
}

export function renderBubbleChart(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, unknown>[],
    config: BubbleChartConfig = {}
) {
    const categoryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;

    const textColor = config.textColor ?? '#0b1220';
    const topColorRange = config.topColor ? [config.topColor, config.topColor] : ["#2E7A7A", "#1B2A49"];
    const bottomColorRange = config.bottomColor ? [config.bottomColor, config.bottomColor] : ["#F2C57C", "#D9973B"];
    const grayColor = config.middleColor ?? "#D1D5DB";
    const fontFamily = spec.style?.fontFamily ?? 'Poppins, Arial, sans-serif';

    // 1. Prepare Data
    const sorted = [...data].sort((a, b) => Number(b[valueKey]) - Number(a[valueKey]));
    const top5 = sorted.slice(0, 5).map(d => String(d[categoryKey]));
    const bottom5 = sorted.slice(-5).map(d => String(d[categoryKey]));

    const nodes = data.map((d) => {
        const val = Number(d[valueKey]);
        const cat = String(d[categoryKey]);
        let group = 'middle';
        if (top5.includes(cat)) group = 'top';
        else if (bottom5.includes(cat)) group = 'bottom';

        return {
            id: cat,
            value: Number.isFinite(val) ? val : 0,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            radius: 0,
            group
        };
    });

    if (nodes.length === 0) return;

    // 2. Setup SVG
    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 800;
    const height = Number(svg.attr('height')) || 400;

    const titlePadding = 45;
    const availableHeight = spec.title ? height - titlePadding : height;

    svg.selectAll('*').remove();

    const g = svg.append("g")
        .attr("transform", spec.title ? `translate(0, ${titlePadding})` : "");
    const center = { x: width / 2, y: availableHeight / 2 };

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
            .style('font-family', fontFamily)
            .text(spec.title);
    }

    // 3. Scales
    const maxVal = d3.max(nodes, d => d.value) || 1;
    const minVal = d3.min(nodes, d => d.value) || 0;
    const rScale = d3.scaleSqrt().domain([0, maxVal]).range([8, 54]);
    nodes.forEach(n => n.radius = rScale(n.value));

    const topColorScale = d3.scaleLinear<string>().domain([0, 1]).range(topColorRange);
    const bottomColorScale = d3.scaleLinear<string>().domain([0, 1]).range(bottomColorRange);

    // 4. Render Nodes
    const nodeG = g.selectAll("g.node")
        .data(nodes)
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", `translate(${center.x},${center.y})`);

    nodeG.append("circle")
        .attr("r", d => d.radius)
        .attr("fill", d => {
            const t = (d.value - minVal) / (maxVal - minVal || 1);
            if (d.group === 'top') return topColorScale(t);
            if (d.group === 'bottom') return bottomColorScale(t);
            return grayColor;
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5)
        .attr("opacity", 0.98);

    nodeG.append("text")
        .attr("class", "country-label")
        .attr("text-anchor", "middle")
        .attr("dy", "-0.45em")
        .style("font-family", fontFamily)
        .style("font-weight", "600")
        .style("pointer-events", "none");

    nodeG.append("text")
        .attr("class", "value-label")
        .attr("text-anchor", "middle")
        .attr("dy", "0.9em")
        .style("font-family", fontFamily)
        .style("font-weight", "700")
        .style("pointer-events", "none");

    function fitLabels() {
        nodeG.selectAll<SVGTextElement, typeof nodes[0]>('text.country-label').each(function (d) {
            const txt = d3.select(this);
            const maxWidth = Math.max(8, d.radius * 2 - 8);
            let name = d.id;
            let fontSize = 11;
            txt.style('font-size', fontSize + 'px').text(name || '').style('fill', d.group === 'middle' ? textColor : '#ffffff');
            let bbox = this.getBBox();
            while (bbox.width > maxWidth && fontSize > 6) {
                fontSize -= 1;
                txt.style('font-size', fontSize + 'px');
                bbox = this.getBBox();
            }
            if (bbox.width > maxWidth) {
                const first = name.split(/\s+/)[0] || '';
                txt.text(first);
                bbox = this.getBBox();
            }
            if (bbox.width > maxWidth) {
                const initials = name.split(/\s+/).map(w => w[0]).join('');
                txt.text(initials.toUpperCase());
                bbox = this.getBBox();
            }
            if (bbox.width > maxWidth) txt.style('display', 'none');
            else txt.style('display', null);
        });

        nodeG.selectAll<SVGTextElement, typeof nodes[0]>('text.value-label').each(function (d) {
            const vtxt = d3.select(this);
            vtxt.text(`${Number.isInteger(d.value) ? d.value.toFixed(0) : d.value.toFixed(1)}`)
                .style('font-size', Math.max(8, Math.round(d.radius / 3)) + 'px')
                .style('fill', d.group === 'middle' ? textColor : '#ffffff');
        });
    }

    fitLabels();

    // 5. Simulation
    const innerR = 0;
    const middleR = Math.min(width, availableHeight) * 0.22;
    const outerR = Math.min(width, availableHeight) * 0.38;

    const simulation = d3.forceSimulation(nodes as any)
        .force("charge", d3.forceManyBody().strength(-12))
        .force("collision", d3.forceCollide().radius((d: any) => d.radius + 8).iterations(1))
        .alphaDecay(0.02);

    function radialForce() {
        for (const node of nodes) {
            const groupNodes = nodes.filter(n => n.group === node.group);
            const idx = groupNodes.findIndex(n => n.id === node.id);
            const angle = (idx / groupNodes.length) * Math.PI * 2 + (node.group === 'middle' ? Math.PI / 12 : 0);

            let targetR = middleR;
            if (node.group === 'top') targetR = innerR + (Math.random() * 6);
            if (node.group === 'bottom') targetR = outerR;

            const tx = center.x + Math.cos(angle) * targetR;
            const ty = center.y + Math.sin(angle) * targetR;

            const k = 0.06;
            node.vx += (tx - node.x) * k;
            node.vy += (ty - node.y) * k;
        }
    }

    simulation.on("tick", () => {
        radialForce();
        nodeG.attr("transform", d => `translate(${d.x},${d.y})`);
        fitLabels();
    });

    // Initial random positions
    nodes.forEach(n => {
        n.x = center.x + (Math.random() - 0.5) * 20;
        n.y = center.y + (Math.random() - 0.5) * 20;
    });

    // 6. Interactivity
    const tooltip = d3.select("body").selectAll(".bubble-tooltip").data([0]).join("div")
        .attr("class", "bubble-tooltip")
        .style("position", "absolute")
        .style("pointer-events", "none")
        .style("background", "#0b1220")
        .style("color", "white")
        .style("padding", "8px 10px")
        .style("border-radius", "6px")
        .style("font-size", "12px")
        .style("display", "none")
        .style("z-index", "1000");

    nodeG.on("mousemove", (event, d) => {
        tooltip.style("display", "block")
            .style("left", (event.pageX + 12) + "px")
            .style("top", (event.pageY + 12) + "px")
            .html(`<strong>${d.id}</strong><div style="margin-top:6px">Score: <strong>${d.value}</strong></div>`);
    })
        .on("mouseout", () => tooltip.style("display", "none"));

    const drag = d3.drag<SVGGElement, any>()
        .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.2).restart();
            d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null; d.fy = null;
        });

    nodeG.call(drag);

    simulation.alpha(0.9).restart();
    setTimeout(() => { simulation.alphaTarget(0); }, 1500);
}
