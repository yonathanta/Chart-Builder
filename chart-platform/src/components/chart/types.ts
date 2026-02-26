export type ChartType = 'bar' | 'line'

export interface DataPoint {
  label: string
  value: number
}

export interface ChartConfig {
  chartType: ChartType
  title: string
  colors: [string, string]
  data: DataPoint[]
  xAxisLabel: string
  yAxisLabel: string
  animationEnabled: boolean
}
