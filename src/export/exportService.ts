import { jsPDF } from "jspdf";
import { Canvg } from "canvg";
import html2canvas from "html2canvas";
import type { ChartSpec } from "../specs/chartSpec";

export type ExportFormat = "svg" | "png" | "pdf" | "html" | "spec-json" | "project-json";

export type ExportOptions = {
  fileName?: string;
  scale?: number;
  background?: string;
  page?: {
    orientation?: "portrait" | "landscape";
    size?: "a4" | "letter";
    marginMm?: number;
  };
};

export type ProjectExportMetadata = {
  selectedDatasetId?: string;
  selectedDatasetName?: string;
  activeFilters?: Array<{ column: string; values: string[] }>;
  chartType?: string;
  style?: ChartSpec["style"];
  filteredData?: any[];
};

export type HtmlExportChartState = {
  data: Record<string, unknown>[];
  config: Record<string, unknown>;
  style: Record<string, unknown>;
  animation: {
    enabled: boolean;
    duration: number;
    easing: string;
  };
  metadata?: {
    title?: string;
    description?: string;
    source?: string;
    exportedAt?: string;
    chartId?: string;
    projectId?: string;
    datasetId?: string;
    filters?: Array<{ column: string; values: string[] }>;
  };
};

export interface ExportService {
  exportSVG(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportPNG(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportPDF(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportHTML(
    svg: SVGSVGElement,
    spec: ChartSpec,
    chartState?: HtmlExportChartState,
    options?: ExportOptions,
  ): Promise<Blob>;
  exportSpec(spec: ChartSpec, options?: ExportOptions): Promise<Blob>;
  exportProject(spec: ChartSpec, data?: any[], metadata?: ProjectExportMetadata): Promise<Blob>;
}

// Utility: serialize SVG to string with optional background rect.
function serializeSVG(svg: SVGSVGElement, background?: string): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  if (background) {
    const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", clone.getAttribute("width") ?? "100%");
    rect.setAttribute("height", clone.getAttribute("height") ?? "100%");
    rect.setAttribute("fill", background);
    clone.insertBefore(rect, clone.firstChild);
  }
  const serializer = new XMLSerializer();
  return serializer.serializeToString(clone);
}

// Utility: render SVG string to canvas using Canvg for robust parsing.
async function svgStringToCanvas(svgString: string, scale = 1): Promise<HTMLCanvasElement> {
  const svg = new Blob([svgString], { type: "image/svg+xml" });
  const url = URL.createObjectURL(svg);

  const { width, height } = await extractSvgDimensions(svgString);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context not available");

  const canvg = await Canvg.from(ctx, url);
  await canvg.render();
  URL.revokeObjectURL(url);
  return canvas;
}

async function extractSvgDimensions(svgString: string): Promise<{ width: number; height: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, "image/svg+xml");
  const svg = doc.documentElement;
  const width = Number(svg.getAttribute("width")) || 800;
  const height = Number(svg.getAttribute("height")) || 480;
  return { width, height };
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error("Failed to create blob"));
      resolve(blob);
    }, type);
  });
}

async function createHtmlExportSnapshot(
  svgString: string,
  spec: ChartSpec,
  chartState: HtmlExportChartState,
  options?: ExportOptions,
): Promise<string> {
  const exportWidth = Math.max(800, Number(spec.layout?.width ?? 800));
  const exportHeight = Math.max(500, Number(spec.layout?.height ?? 500));
  const animationDuration = chartState.animation?.enabled ? Math.max(0, Number(chartState.animation.duration ?? 0)) : 0;
  const scale = Math.max(2, Number(options?.scale ?? 2));

  const stage = document.createElement("div");
  stage.setAttribute("aria-hidden", "true");
  stage.style.position = "fixed";
  stage.style.left = "-100000px";
  stage.style.top = "0";
  stage.style.width = `${exportWidth}px`;
  stage.style.height = `${exportHeight}px`;
  stage.style.padding = "24px";
  stage.style.background = String(spec.style?.background ?? options?.background ?? "#ffffff");
  stage.style.overflow = "visible";
  stage.style.opacity = "1";
  stage.style.pointerEvents = "none";
  stage.style.zIndex = "-1";

  const frame = document.createElement("div");
  frame.style.width = "100%";
  frame.style.height = "100%";
  frame.style.display = "flex";
  frame.style.alignItems = "stretch";
  frame.style.justifyContent = "stretch";
  frame.style.background = "#ffffff";
  frame.style.overflow = "visible";
  frame.style.border = "none";
  frame.style.boxShadow = "none";

  frame.innerHTML = svgString;
  const svg = frame.querySelector("svg");
  if (svg instanceof SVGSVGElement) {
    svg.setAttribute("width", String(exportWidth - 48));
    svg.setAttribute("height", String(exportHeight - 48));
    svg.style.width = "100%";
    svg.style.height = "100%";
    svg.style.maxWidth = "none";
    svg.style.maxHeight = "none";
    svg.style.display = "block";
    svg.style.overflow = "visible";
    svg.style.background = "transparent";
  }

  stage.appendChild(frame);
  document.body.appendChild(stage);

  try {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    if (animationDuration > 0) {
      await new Promise((resolve) => window.setTimeout(resolve, animationDuration + 120));
    }

    const canvas = await html2canvas(stage, {
      scale,
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#ffffff",
      logging: false,
      width: exportWidth,
      height: exportHeight,
    });

    return canvas.toDataURL("image/png");
  } finally {
    stage.remove();
  }
}

export const exportService: ExportService = {
  async exportSVG(svg, options) {
    const svgString = serializeSVG(svg, options?.background);
    return new Blob([svgString], { type: "image/svg+xml" });
  },

  async exportPNG(svg, options) {
    const scale = options?.scale ?? 1;
    const svgString = serializeSVG(svg, options?.background);
    const canvas = await svgStringToCanvas(svgString, scale);
    return canvasToBlob(canvas, "image/png");
  },

  async exportPDF(svg, options) {
    const scale = options?.scale ?? 1;
    const svgString = serializeSVG(svg, options?.background);
    const canvas = await svgStringToCanvas(svgString, scale);
    const pngBlob = await canvasToBlob(canvas, "image/png");
    const pngDataUrl = await blobToDataUrl(pngBlob);

    const orientation = options?.page?.orientation ?? "landscape";
    const size = options?.page?.size ?? "a4";
    const marginMm = options?.page?.marginMm ?? 10;
    const doc = new jsPDF({ orientation, unit: "mm", format: size });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const availableWidth = pageWidth - marginMm * 2;
    const availableHeight = pageHeight - marginMm * 2;

    const imgProps = await doc.getImageProperties(pngDataUrl);
    const ratio = Math.min(availableWidth / imgProps.width, availableHeight / imgProps.height);
    const renderWidth = imgProps.width * ratio;
    const renderHeight = imgProps.height * ratio;
    const x = (pageWidth - renderWidth) / 2;
    const y = (pageHeight - renderHeight) / 2;

    doc.addImage(pngDataUrl, "PNG", x, y, renderWidth, renderHeight);
    return doc.output("blob");
  },

  async exportHTML(svg, spec, chartState, options) {
    const svgString = serializeSVG(svg, options?.background);
    const effectiveState: HtmlExportChartState = chartState ?? {
      data: [],
      config: {
        type: spec.type,
        encoding: spec.encoding,
        layout: spec.layout,
      },
      style: {
        ...(spec.style ?? {}),
      },
      animation: {
        enabled: false,
        duration: 0,
        easing: "ease",
      },
      metadata: {
        title: spec.title,
        exportedAt: new Date().toISOString(),
      },
    };
    const exportWidth = Math.max(800, Number(spec.layout?.width ?? 800));
    const exportHeight = Math.max(500, Number(spec.layout?.height ?? 500));
    const snapshotDataUrl = await createHtmlExportSnapshot(svgString, spec, effectiveState, options);
    const safeStateJson = JSON.stringify(effectiveState).replace(/<\//g, "<\\/");
    const safeSvgJson = JSON.stringify(svgString).replace(/<\//g, "<\\/");
    const safeSnapshotJson = JSON.stringify(snapshotDataUrl).replace(/<\//g, "<\\/");
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(spec.title ?? "Chart export")}</title>
  <style>
    :root {
      --bg: ${escapeHtml(String(spec.style?.background ?? "#ffffff"))};
      --text: #111827;
      --muted: #6b7280;
      --card: #ffffff;
      --border: #e5e7eb;
      --radius: 12px;
      --shadow: 0 10px 24px rgba(0, 0, 0, 0.08);
      --maxw: ${Math.max(exportWidth + 120, 960)}px;
      --export-width: ${exportWidth}px;
      --export-height: ${exportHeight}px;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      background: linear-gradient(180deg, var(--bg), #f8fafc);
      color: var(--text);
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
      padding: 24px;
    }

    .wrap {
      max-width: var(--maxw);
      margin: 0 auto;
      display: grid;
      gap: 12px;
    }

    .header h1 {
      margin: 0;
      font-size: 22px;
      line-height: 1.25;
    }

    .meta {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }

    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      padding: 16px;
      overflow: visible;
    }

    #chart-host {
      width: var(--export-width);
      min-height: var(--export-height);
      height: var(--export-height);
      margin: 0 auto;
      display: flex;
      align-items: stretch;
      justify-content: stretch;
      overflow: visible;
      background: #ffffff;
    }

    #chart-host > img,
    #chart-host > svg {
      width: 100%;
      height: 100%;
      display: block;
      transform-origin: 50% 50%;
      object-fit: contain;
      background: #ffffff;
      overflow: visible;
    }

    #chart-host > img {
      border: 1px solid var(--border);
      border-radius: 10px;
    }

    details {
      border-top: 1px dashed var(--border);
      padding-top: 10px;
    }

    summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 13px;
      user-select: none;
    }

    pre {
      margin: 10px 0 0;
      max-height: 300px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.4;
      background: #0f172a;
      color: #e2e8f0;
      border-radius: 8px;
      padding: 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media (max-width: 720px) {
      body { padding: 12px; }
      .card { padding: 10px; }
      .header h1 { font-size: 18px; }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <header class="header">
      <h1>${escapeHtml(spec.title ?? "Chart export")}</h1>
      <div class="meta" id="meta"></div>
    </header>

    <section class="card">
      <div id="chart-host" aria-label="Chart container"></div>
    </section>

    <section class="card">
      <details>
        <summary>Embedded Chart State (offline)</summary>
        <pre id="state"></pre>
      </details>
    </section>
  </main>

  <script>
    const chartState = ${safeStateJson};
    const serializedSvg = ${safeSvgJson};
    const snapshotDataUrl = ${safeSnapshotJson};

    function renderChart(state) {
      const host = document.getElementById("chart-host");
      const meta = document.getElementById("meta");
      const stateEl = document.getElementById("state");
      if (!host) return;

      host.innerHTML = "";
      const snapshot = document.createElement("img");
      snapshot.src = snapshotDataUrl;
      snapshot.alt = String(state?.metadata?.title || "Exported chart snapshot");
      host.appendChild(snapshot);

      const count = Array.isArray(state?.data) ? state.data.length : 0;
      const chartType = state?.config?.type || state?.config?.chartType || "unknown";
      const exportedAt = state?.metadata?.exportedAt || "";
      const source = state?.metadata?.source || "";
      const description = state?.metadata?.description || "";
      const parts = [
        "Type: " + String(chartType),
        "Rows: " + String(count),
        exportedAt ? "Exported: " + new Date(exportedAt).toLocaleString() : "",
        source ? "Source: " + source : "",
        description ? "Description: " + description : "",
      ].filter(Boolean);
      if (meta) meta.textContent = parts.join(" | ");
      if (stateEl) stateEl.textContent = JSON.stringify(state, null, 2);

      if (snapshot && state?.animation?.enabled) {
        const duration = Number(state.animation.duration || 700);
        const easing = String(state.animation.easing || "ease");
        snapshot.style.opacity = "0";
        snapshot.style.transform = "translateY(10px) scale(0.995)";
        snapshot.style.transition = "opacity " + duration + "ms " + easing + ", transform " + duration + "ms " + easing;

        requestAnimationFrame(() => {
          snapshot.style.opacity = "1";
          snapshot.style.transform = "translateY(0) scale(1)";
        });
      }
    }

    renderChart(chartState);
  </script>
</body>
</html>`;
    return new Blob([html], { type: "text/html" });
  },

  async exportSpec(spec) {
    const json = JSON.stringify(spec, null, 2);
    return new Blob([json], { type: "application/json" });
  },

  async exportProject(spec, data, metadata) {
    const project = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      spec,
      data: data || [],
      filteredData: metadata?.filteredData || [],
      selectedDatasetId: metadata?.selectedDatasetId || "",
      selectedDatasetName: metadata?.selectedDatasetName || "",
      activeFilters: metadata?.activeFilters || [],
      chartType: metadata?.chartType || spec.type,
      style: metadata?.style || spec.style,
    };
    const json = JSON.stringify(project, null, 2);
    return new Blob([json], { type: "application/json" });
  },
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("Failed to read data URL"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
