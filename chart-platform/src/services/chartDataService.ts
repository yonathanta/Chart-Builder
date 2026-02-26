import type { DataPoint } from '../components/chart/types'

interface LegacyBarRecord {
  category: string
  value: number
  series?: string
}

function toSeriesNumber(value: string | undefined): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY
  }

  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY
}

export async function loadLegacySampleBarData(): Promise<DataPoint[]> {
  const response = await fetch('/data/sample-bar.json')
  if (!response.ok) {
    throw new Error('Failed to load sample bar dataset.')
  }

  const rows = (await response.json()) as LegacyBarRecord[]
  const latestByCategory = new Map<string, LegacyBarRecord>()

  for (const row of rows) {
    const current = latestByCategory.get(row.category)
    if (!current || toSeriesNumber(row.series) >= toSeriesNumber(current.series)) {
      latestByCategory.set(row.category, row)
    }
  }

  return [...latestByCategory.values()].map((row) => ({
    label: row.category,
    value: row.value,
  }))
}
