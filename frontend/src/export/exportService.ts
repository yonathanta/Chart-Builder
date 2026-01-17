import { jsPDF } from "jspdf";
import { Canvg } from "canvg";
import type { ChartSpec } from "../specs/chartSpec";

export type ExportFormat = "svg" | "png" | "pdf" | "html" | "spec-json";

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

export interface ExportService {
  exportSVG(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportPNG(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportPDF(svg: SVGSVGElement, options?: ExportOptions): Promise<Blob>;
  exportHTML(svg: SVGSVGElement, spec: ChartSpec, options?: ExportOptions): Promise<Blob>;
  exportSpec(spec: ChartSpec, options?: ExportOptions): Promise<Blob>;
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

  async exportHTML(svg, spec, options) {
    const svgString = serializeSVG(svg, options?.background);
    const specJson = JSON.stringify(spec, null, 2);
    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(spec.title ?? "Chart export")}</title>
</head>
<body>
  <div id="chart">${svgString}</div>
  <pre id="spec" style="white-space: pre-wrap; font-family: monospace;">${escapeHtml(specJson)}</pre>
</body>
</html>`;
    return new Blob([html], { type: "text/html" });
  },

  async exportSpec(spec) {
    const json = JSON.stringify(spec, null, 2);
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
