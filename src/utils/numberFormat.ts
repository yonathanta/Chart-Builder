export const NUMBER_FORMAT_OPTIONS = [
  'default',
  'integer',
  '2-decimal',
  '3-decimal',
  'thousands',
  'millions',
  'billions',
  'trillions',
  'percent',
  'scientific',
  'auto',
] as const;

export type NumberFormatOption = (typeof NUMBER_FORMAT_OPTIONS)[number];

const OPTION_SET = new Set<string>(NUMBER_FORMAT_OPTIONS);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function trimZeros(input: string): string {
  return input.replace(/\.0+$|(?<=\.[0-9]*?)0+$/g, '').replace(/\.$/, '');
}

function formatWithSuffix(value: number, divisor: number, suffix: string, decimals = 2): string {
  const scaled = value / divisor;
  const absScaled = Math.abs(scaled);
  const places = absScaled >= 100 ? 0 : absScaled >= 10 ? 1 : decimals;
  return `${trimZeros(scaled.toFixed(places))}${suffix}`;
}

export function normalizeNumberFormat(format: unknown): NumberFormatOption {
  if (typeof format !== 'string') {
    return 'default';
  }

  const lowered = format.trim().toLowerCase();
  return OPTION_SET.has(lowered) ? (lowered as NumberFormatOption) : 'default';
}

export function formatNumber(value: unknown, format: NumberFormatOption = 'default'): string {
  const numeric = toFiniteNumber(value);
  if (numeric === null) {
    return '-';
  }

  const abs = Math.abs(numeric);
  const normalized = normalizeNumberFormat(format);

  if (normalized === 'auto') {
    if (abs === 0) return '0';
    if (abs < 1) return trimZeros(numeric.toFixed(abs < 0.01 ? 3 : 2));
    if (abs >= 1_000_000) return formatWithSuffix(numeric, 1_000_000, 'M');
    if (abs >= 1_000) return formatWithSuffix(numeric, 1_000, 'K');
    return abs >= 100 ? trimZeros(numeric.toFixed(0)) : trimZeros(numeric.toFixed(2));
  }

  if (normalized === 'default') {
    if (abs === 0) return '0';
    if (abs < 0.001) return numeric.toExponential(2);
    return new Intl.NumberFormat('en-US', {
      maximumFractionDigits: abs < 1 ? 4 : 2,
      minimumFractionDigits: 0,
    }).format(numeric);
  }

  if (normalized === 'integer') {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Math.round(numeric));
  }

  if (normalized === '2-decimal') {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(numeric);
  }

  if (normalized === '3-decimal') {
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(numeric);
  }

  if (normalized === 'thousands') {
    return formatWithSuffix(numeric, 1_000, 'K');
  }

  if (normalized === 'millions') {
    return formatWithSuffix(numeric, 1_000_000, 'M');
  }

  if (normalized === 'billions') {
    return formatWithSuffix(numeric, 1_000_000_000, 'B');
  }

  if (normalized === 'trillions') {
    return formatWithSuffix(numeric, 1_000_000_000_000, 'T');
  }

  if (normalized === 'percent') {
    return `${trimZeros((numeric * 100).toFixed(2))}%`;
  }

  return numeric.toExponential(2);
}

export function createNumberFormatter(format: NumberFormatOption = 'default'): (value: unknown) => string {
  const normalized = normalizeNumberFormat(format);
  return (value: unknown) => formatNumber(value, normalized);
}
