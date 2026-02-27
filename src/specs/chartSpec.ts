import { z } from "zod";
import type { DataQuery } from "../data/providers/DataProvider";

export const chartTypeValues = [
  "bar",
  "line",
  "bubble",
  "area",
  "dotDonut",
  "orbitDonut",
  "scatter",
  "map",
  "pie",
  "stackedBar",
  "stackedArea",
] as const;

export type ChartType = (typeof chartTypeValues)[number];

const fieldRefSchema = z.object({
  field: z.string(),
  label: z.string().optional(),
  type: z.enum(["string", "number", "date", "categorical"]).optional(),
});

const dataQuerySchema = z.object({
  source: z.string(),
  params: z.record(z.unknown()).optional(),
  schema: z.record(z.string()).optional(),
  snapshotId: z.string().optional(),
});

export const dataBindingSchema = z.object({
  provider: z.string(),
  kind: z.enum(["json", "http", "db"]).default("json"),
  query: dataQuerySchema as unknown as z.ZodType<DataQuery>,
  syncMode: z.enum(["live", "snapshot"]).default("live"),
});

export type DataBinding = z.infer<typeof dataBindingSchema>;

export const encodingSchema = z.object({
  category: fieldRefSchema,
  // value encoding may include an aggregation directive
  value: fieldRefSchema.extend({
    aggregate: z
      .enum(["none", "sum", "avg", "median", "count"])
      .default("none"),
  }),
  x: fieldRefSchema.optional(),
  y: fieldRefSchema.optional(),
  size: fieldRefSchema.optional(),
  series: fieldRefSchema.optional(),
  color: fieldRefSchema.optional(),
  tooltipFields: z.array(fieldRefSchema).optional(),
  sort: z
    .object({
      field: z.string(),
      order: z.enum(["asc", "desc"]).default("desc"),
    })
    .optional(),
});

export type Encoding = z.infer<typeof encodingSchema>;

export const layoutSchema = z.object({
  preset: z
    .enum(["single", "horizontal", "vertical", "grid", "smallMultiples", "circular"])
    .default("single"),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  padding: z
    .object({
      top: z.number().nonnegative().default(16),
      right: z.number().nonnegative().default(16),
      bottom: z.number().nonnegative().default(24),
      left: z.number().nonnegative().default(24),
    })
    .partial()
    .optional(),
  smallMultiple: z
    .object({
      columns: z.number().int().positive().default(2),
      spacing: z.number().nonnegative().default(16),
    })
    .optional(),
});

export type Layout = z.infer<typeof layoutSchema>;

export const styleSchema = z.object({
  palette: z.array(z.string()).optional(),
  background: z.string().optional(),
  fontFamily: z.string().optional(),
  axis: z
    .object({
      xLabel: z.string().optional(),
      yLabel: z.string().optional(),
      tickCount: z.number().int().positive().optional(),
      grid: z.boolean().optional(),
    })
    .optional(),
  legend: z
    .object({
      position: z.enum(["none", "top", "right", "bottom", "left"]).default("right"),
      show: z.boolean().default(true),
    })
    .optional(),
  locale: z.string().optional(),
});

export type Style = z.infer<typeof styleSchema>;

export const animationSchema = z.object({
  enabled: z.boolean().default(true),
  durationMs: z.number().int().positive().default(600),
  easing: z
    .enum(["ease", "ease-in", "ease-out", "ease-in-out", "linear"])
    .default("ease"),
  stagger: z.boolean().default(false),
});

export type Animation = z.infer<typeof animationSchema>;

export const accessibilitySchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  longDescription: z.string().optional(),
  language: z.string().optional(),
  colorBlindMode: z.enum(["none", "protanopia", "deuteranopia", "tritanopia"]).default("none"),
});

export type Accessibility = z.infer<typeof accessibilitySchema>;

export const chartSpecSchema = z.object({
  version: z.literal("1.0"),
  id: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  type: z.enum(chartTypeValues),
  layout: layoutSchema.optional(),
  data: dataBindingSchema,
  encoding: encodingSchema,
  style: styleSchema.optional(),
  animation: animationSchema.optional(),
  accessibility: accessibilitySchema.optional(),
  annotations: z.array(z.string()).optional(),
});

export type ChartSpec = z.infer<typeof chartSpecSchema>;
