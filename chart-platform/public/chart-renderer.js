// Global ChartRenderer to ensure 100% consistency between Vue frontend and backend HTML/PDF generation
window.ChartRenderer = {
  render: function(svgElement, dataset, chartConfig, dimensions) {
    if (!svgElement || !dataset || !chartConfig || !dimensions) {
      console.warn("ChartRenderer: Missing required arguments", { svgElement, dataset, chartConfig, dimensions });
      return;
    }

    // Default to d3 if available globally
    const d3 = window.d3;
    if (!d3) {
      console.error("ChartRenderer: d3 is not loaded");
      return;
    }

    const { width, height } = dimensions;
    const margin = { top: 40, right: 24, bottom: 44, left: 56 };
    const innerWidth = Math.max(10, width - margin.left - margin.right);
    const innerHeight = Math.max(10, height - margin.top - margin.bottom);

    const svg = d3
      .select(svgElement)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    svg.selectAll('*').remove();

    const data = dataset;
    const safeMax = d3.max(data, (d) => d.value || 0) || 1;

    const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Title
    root
      .append('text')
      .attr('x', 0)
      .attr('y', -12)
      .attr('fill', '#111827')
      .style('font-size', '16px')
      .style('font-weight', '600')
      .text(chartConfig.title || '');

    // Scales
    const xScale = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, innerWidth])
      .padding(0.25);

    const yScale = d3.scaleLinear().domain([0, safeMax * 1.1]).nice().range([innerHeight, 0]);

    // Axes
    root
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(d3.axisBottom(xScale));

    root.append('g').call(d3.axisLeft(yScale).ticks(6));

    // Axis Labels
    if (chartConfig.xAxisLabel) {
      root
        .append('text')
        .attr('x', innerWidth / 2)
        .attr('y', innerHeight + 38)
        .attr('text-anchor', 'middle')
        .attr('fill', '#374151')
        .style('font-size', '12px')
        .text(chartConfig.xAxisLabel);
    }

    if (chartConfig.yAxisLabel) {
      root
        .append('text')
        .attr('transform', 'rotate(-90)')
        .attr('x', -innerHeight / 2)
        .attr('y', -40)
        .attr('text-anchor', 'middle')
        .attr('fill', '#374151')
        .style('font-size', '12px')
        .text(chartConfig.yAxisLabel);
    }

    // Chart Types
    if (chartConfig.chartType === 'line') {
      const lineGenerator = d3
        .line()
        .x((d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .y((d) => yScale(d.value || 0));

      const linePath = root
        .append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', chartConfig.colors?.[0] || '#2563eb')
        .attr('stroke-width', 2.5)
        .attr('d', lineGenerator);

      if (chartConfig.animationEnabled) {
        const totalLength = linePath.node()?.getTotalLength() || 0;
        linePath
          .attr('stroke-dasharray', `${totalLength} ${totalLength}`)
          .attr('stroke-dashoffset', totalLength)
          .transition()
          .duration(600)
          .ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      }

      root
        .selectAll('circle.data-point')
        .data(data)
        .join('circle')
        .attr('class', 'data-point')
        .attr('cx', (d) => (xScale(d.label) || 0) + xScale.bandwidth() / 2)
        .attr('cy', (d) => yScale(d.value || 0))
        .attr('r', 4)
        .attr('fill', chartConfig.colors?.[1] || '#1d4ed8');
    } else {
      const bars = root
        .selectAll('rect.bar')
        .data(data)
        .join('rect')
        .attr('class', 'bar')
        .attr('x', (d) => xScale(d.label) || 0)
        .attr('y', innerHeight)
        .attr('width', xScale.bandwidth())
        .attr('height', 0)
        .attr('rx', 4)
        .attr('fill', chartConfig.colors?.[0] || '#2563eb');

      const targetBars = bars
        .attr('y', (d) => yScale(d.value || 0))
        .attr('height', (d) => innerHeight - yScale(d.value || 0));

      if (chartConfig.animationEnabled) {
        targetBars.transition().duration(550).ease(d3.easeCubicOut);
      }
    }
  }
};
