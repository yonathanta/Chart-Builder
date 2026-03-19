import api from './api'

export type DashboardRecord = {
  id: string
  name: string
  projectId: string
  userId: string
  createdAt: string
  updatedAt: string
}

export type DashboardChartLayout = {
  id: string
  chartId: string
  chartName: string
  positionX: number
  positionY: number
  width: number
  height: number
}

export type DashboardDetails = DashboardRecord & {
  charts: DashboardChartLayout[]
}

export type DashboardStudioState = {
  dashboardId: string
  layoutJson: string
  componentsJson: string
  pageStructureJson: string
  snapshotJson: string
  updatedAt: string
}

export type SaveDashboardStudioStateRequest = {
  dashboardId: string
  layout: unknown
  components: unknown
  pageStructure: unknown
  snapshot: unknown
}

export type UpdateDashboardChartLayoutRequest = {
  id: string
  positionX: number
  positionY: number
  width: number
  height: number
}

export type AddDashboardChartRequest = {
  dashboardId: string
  chartId: string
  positionX: number
  positionY: number
  width: number
  height: number
}

export async function getDashboardsByProject(projectId: string): Promise<DashboardRecord[]> {
  const response = await api.get<DashboardRecord[]>(`/dashboards/project/${projectId}`)
  return response.data
}

export async function getDashboard(dashboardId: string): Promise<DashboardDetails> {
  const response = await api.get<DashboardDetails>(`/dashboards/${dashboardId}`)
  return response.data
}

export async function updateChartLayout(payload: UpdateDashboardChartLayoutRequest): Promise<DashboardChartLayout> {
  const response = await api.put<DashboardChartLayout>('/dashboards/update-chart-layout', payload)
  return response.data
}

export async function addChartToDashboard(payload: AddDashboardChartRequest): Promise<DashboardChartLayout> {
  const response = await api.post<DashboardChartLayout>('/dashboards/add-chart', payload)
  return response.data
}

export async function saveDashboardState(payload: SaveDashboardStudioStateRequest): Promise<DashboardStudioState> {
  const response = await api.post<DashboardStudioState>('/dashboard/save', payload)
  return response.data
}

export async function loadDashboardState(dashboardId: string): Promise<DashboardStudioState> {
  const response = await api.get<DashboardStudioState>('/dashboard/load', {
    params: { dashboardId },
  })
  return response.data
}

const dashboardService = {
  getDashboardsByProject,
  getDashboard,
  updateChartLayout,
  addChartToDashboard,
  saveDashboardState,
  loadDashboardState,
}

export default dashboardService
