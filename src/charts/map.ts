import * as d3 from 'd3';
import type { ChartSpec } from '../specs/chartSpec';

export interface MapConfig {
    colorMode?: "gradient" | "threshold";
    colorScheme?: string; // D3 interpolator name like 'interpolateBlues'
    showTooltip?: boolean;
    projectionCenter?: [number, number];
    scale?: number;
    animationDuration?: number;
    backgroundColor?: string;
    noDataColor?: string;
    thresholds?: number[];
    useCustomGradient?: boolean;
    gradientLowColor?: string;
    gradientHighColor?: string;
}

const AFRICA_ISO = [
    "DZA", "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD", "COM",
    "COG", "COD", "DJI", "EGY", "GNQ", "ERI", "SWZ", "ETH", "GAB", "GMB", "GHA",
    "GIN", "GNB", "KEN", "LSO", "LBR", "LBY", "MDG", "MWI", "MLI", "MRT", "MUS",
    "MAR", "MOZ", "NAM", "NER", "NGA", "RWA", "STP", "SEN", "SYC", "SLE", "SOM",
    "ZAF", "SSD", "SDN", "TGO", "TUN", "UGA", "ZMB", "ZWE"
];

// Cache for GeoJSON to avoid redundant fetches
let cachedWorld: any = null;

export async function renderAfricaMap(
    svgEl: SVGSVGElement,
    spec: ChartSpec,
    data: Record<string, unknown>[],
    config: MapConfig = {}
) {
    const {
        colorMode = "gradient",
        colorScheme = "interpolateBlues",
        showTooltip = true,
        projectionCenter = [20, 5],
        scale = 400,
        animationDuration = 1000,
        backgroundColor = "#ffffff",
        noDataColor = "#eee",
        thresholds = [20, 40, 60, 80]
    } = config;

    const countryKey = spec.encoding.category.field;
    const valueKey = spec.encoding.value.field;

    const svg = d3.select(svgEl);
    const width = Number(svg.attr('width')) || 900;
    const height = Number(svg.attr('height')) || 700;

    svg.selectAll("*").remove();

    // Apply background color
    svg.style("background-color", backgroundColor);

    // Projection
    const projection = d3.geoMercator()
        .center(projectionCenter as [number, number])
        .scale(scale)
        .translate([width / 2, height / 2]);

    const path = d3.geoPath().projection(projection);

    // Load GeoJSON if not cached
    if (!cachedWorld) {
        try {
            cachedWorld = await d3.json("https://raw.githubusercontent.com/holtzy/D3-graph-gallery/master/DATA/world.geojson");
        } catch (e) {
            console.error("Failed to load map data", e);
            return;
        }
    }

    const africaCountries = cachedWorld.features.filter((f: any) => AFRICA_ISO.includes(f.id));

    // Data processing
    const dataMap = new Map(data.map(d => [String(d[countryKey]), Number(d[valueKey])]));
    const values = Array.from(dataMap.values()).filter(v => Number.isFinite(v));

    // Color scale
    let color: any;
    const interpolator = (d3 as any)[colorScheme] || d3.interpolateBlues;

    if (config.useCustomGradient && config.gradientLowColor && config.gradientHighColor) {
        color = d3.scaleLinear<string>()
            .domain([d3.min(values) || 0, d3.max(values) || 100])
            .range([config.gradientLowColor, config.gradientHighColor])
            .clamp(true);
    } else if (colorMode === "threshold") {
        const range = thresholds.map((_, i) => interpolator(i / (thresholds.length)));
        // Add one more color for the last bin
        range.push(interpolator(1));
        color = d3.scaleThreshold<number, string>()
            .domain(thresholds)
            .range(range);
    } else {
        color = d3.scaleSequential()
            .domain([d3.min(values) || 0, d3.max(values) || 100])
            .interpolator(interpolator);
    }

    const g = svg.append("g");

    // Draw countries
    const countries = g.selectAll("path")
        .data(africaCountries)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path as any)
        .attr("fill", (d: any) => {
            const val = dataMap.get(d.properties.name);
            return val !== undefined ? color(val) : noDataColor;
        })
        .attr("stroke", "#fff")
        .attr("stroke-width", 1)
        .style("cursor", "pointer")
        .on("mouseover", function (this: any, _event: any, d: any) {
            d3.select(this).attr("stroke-width", 2.5).raise();
            if (showTooltip) {
                const val = dataMap.get(d.properties.name);
                const displayVal = val !== undefined ? val : "No data";
                d3.select(this).append("title").text(`${d.properties.name}: ${displayVal}`);
            }
        })
        .on("mouseout", function (this: any) {
            d3.select(this).attr("stroke-width", 1);
            if (showTooltip) d3.select(this).select("title").remove();
        });

    // Animate
    countries.attr("fill-opacity", 0)
        .transition()
        .duration(animationDuration)
        .attr("fill-opacity", 1);

    // Title
    if (spec.title) {
        svg.selectAll('text.chart-title').remove();
        svg.append("text")
            .attr("class", "chart-title")
            .attr("x", width / 2)
            .attr("y", 30)
            .attr("text-anchor", "middle")
            .style("font-size", "18px")
            .style("font-weight", "bold")
            .style("fill", "#374151")
            .text(spec.title);
    }

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 8])
        .on("zoom", (event) => {
            g.attr("transform", event.transform);
        });

    svg.call(zoom);
}
