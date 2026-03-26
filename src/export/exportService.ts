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
    const exportWidth = Math.max(640, Number(spec.layout?.width ?? 960));
    const exportHeight = Math.max(420, Number(spec.layout?.height ?? 500));

    const embeddedData = Array.isArray(effectiveState.data) ? effectiveState.data : [];
    const embeddedConfig = {
      type: effectiveState.config?.type ?? spec.type,
      colors: effectiveState.style?.palette ?? spec.style?.palette ?? ["#2563eb", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444"],
      axis: {
        ...(spec.style?.axis ?? {}),
      },
      labels: {
        title: effectiveState.metadata?.title ?? spec.title ?? "Chart",
        description: effectiveState.metadata?.description ?? spec.description ?? "",
      },
      styles: {
        ...(spec.style ?? {}),
        ...(effectiveState.style ?? {}),
      },
      encoding: spec.encoding,
      layout: spec.layout ?? {},
      animation: {
        enabled: Boolean(effectiveState.animation?.enabled),
        duration: Math.max(200, Number(effectiveState.animation?.duration ?? 800)),
        easing: String(effectiveState.animation?.easing ?? "cubic-out"),
        staggerDelay: 35,
      },
    };

    const safeDataJson = JSON.stringify(embeddedData).replace(/<\//g, "<\\/");
    const safeConfigJson = JSON.stringify(embeddedConfig).replace(/<\//g, "<\\/");
    const safeStyleJson = JSON.stringify(effectiveState.style ?? {}).replace(/<\//g, "<\\/");
    const safeSvgJson = JSON.stringify(svgString).replace(/<\//g, "<\\/");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(spec.title ?? "Chart")}</title>
  <script src="https://d3js.org/d3.v7.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 20px;
      background: ${escapeHtml(String(spec.style?.background ?? "#ffffff"))};
      color: #0f172a;
      font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    }

    .wrap {
      width: min(100%, ${Math.max(exportWidth + 80, 900)}px);
      margin: 0 auto;
    }

    h1 {
      margin: 0 0 6px;
      font-size: 24px;
    }

    .meta {
      margin: 0 0 14px;
      color: #64748b;
      font-size: 13px;
    }

    #chart {
      width: 100%;
      height: ${exportHeight}px;
      min-height: 420px;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      background: #ffffff;
      overflow: visible;
    }

    #chart svg {
      width: 100%;
      height: 100%;
      display: block;
    }

    #chart svg :is(rect, path, circle, ellipse, polygon, polyline, line) {
      transition: opacity 160ms ease, filter 160ms ease;
    }

    @media (max-width: 768px) {
      #chart {
        height: 420px;
      }
    }
  </style>
</head>
<body>
  <main class="wrap">
    <h1>${escapeHtml(spec.title ?? "Chart")}</h1>
    <div id="chart"></div>
  </main>

  <script>
    const data = ${safeDataJson};
    const config = ${safeConfigJson};
    const styles = ${safeStyleJson};
    const serializedSvg = ${safeSvgJson};

    function fitSvgToContent(host, svg) {
      if (!host || !svg) return;

      const widthAttr = Number(svg.getAttribute("width"));
      const heightAttr = Number(svg.getAttribute("height"));
      if (!svg.hasAttribute("viewBox")) {
        const fallbackWidth = Number.isFinite(widthAttr) && widthAttr > 0 ? widthAttr : ${exportWidth};
        const fallbackHeight = Number.isFinite(heightAttr) && heightAttr > 0 ? heightAttr : ${exportHeight};
        svg.setAttribute("viewBox", "0 0 " + fallbackWidth + " " + fallbackHeight);
      }

      try {
        const box = svg.getBBox();
        if (Number.isFinite(box.x) && Number.isFinite(box.y) && box.width > 0 && box.height > 0) {
          const pad = Math.max(8, Math.round(Math.max(box.width, box.height) * 0.02));
          const x = box.x - pad;
          const y = box.y - pad;
          const w = box.width + pad * 2;
          const h = box.height + pad * 2;
          svg.setAttribute("viewBox", x + " " + y + " " + w + " " + h);
        }
      } catch (error) {
        console.warn("Unable to compute SVG bounds for export", error);
      }

      const viewBox = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;
      if (viewBox && viewBox.width > 0 && viewBox.height > 0) {
        host.style.aspectRatio = String(viewBox.width) + " / " + String(viewBox.height);
      }
    }

    function applyMarkInteractions(svg) {
      if (!svg) return;
      const marks = svg.querySelectorAll("rect, path, circle, ellipse, polygon, polyline, line");
      marks.forEach((el, index) => {
        const computed = window.getComputedStyle(el);
        const inlineOpacity = el.getAttribute("opacity");
        const baseOpacity = inlineOpacity == null ? computed.opacity || "1" : inlineOpacity;

        el.dataset.baseOpacity = String(baseOpacity);
        el.style.opacity = "0";
        el.style.cursor = "pointer";

        const delay = 80 + index * 12;
        window.setTimeout(() => {
          el.style.opacity = String(baseOpacity);
        }, delay);

        el.addEventListener("mouseenter", () => {
          const current = Number(el.dataset.baseOpacity || "1");
          const hoverOpacity = Number.isFinite(current) ? Math.max(0.35, current * 0.78) : 0.78;
          el.style.opacity = String(hoverOpacity);
          el.style.filter = "brightness(1.08) drop-shadow(0 1px 2px rgba(15, 23, 42, 0.18))";
        });

        el.addEventListener("mouseleave", () => {
          el.style.opacity = String(el.dataset.baseOpacity || "1");
          el.style.filter = "none";
        });
      });
    }

    function renderExactSvg(containerId) {
      const host = document.getElementById(containerId);
      if (!host) return;

      host.innerHTML = serializedSvg;
      const svg = host.querySelector("svg");
      if (!svg) return;

      // Keep the exported chart visually identical while fitting the container.
      fitSvgToContent(host, svg);
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
      svg.style.display = "block";

      applyMarkInteractions(svg);

      // Small load animation without mutating chart internals.
      svg.style.opacity = "0";
      svg.style.transform = "translateY(8px) scale(0.995)";
      svg.style.transition = "opacity 650ms ease, transform 650ms ease";
      requestAnimationFrame(() => {
        svg.style.opacity = "1";
        svg.style.transform = "translateY(0) scale(1)";
      });
    }

    renderExactSvg("chart");

    window.addEventListener("resize", () => {
      renderExactSvg("chart");
    });
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
