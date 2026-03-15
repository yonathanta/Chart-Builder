import api from "./api";

export type ReportRecord = {
  id: string;
  name: string;
  projectId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateReportPayload = {
  projectId: string;
  name: string;
};

export type ReportChartRecord = {
  id: string;
  chartId: string;
  chartName: string;
  datasetId: string;
  chartType: string;
  configJson: string;
  styleJson: string;
  orderIndex: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type ReportDetails = ReportRecord & {
  charts: ReportChartRecord[];
};

export type AddReportChartPayload = {
  reportId: string;
  chartId: string;
  orderIndex: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type ReorderReportChartPayload = {
  id: string;
  orderIndex: number;
};

export type UpdateReportChartLayoutPayload = {
  id: string;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export async function getReportsByProject(projectId: string): Promise<ReportRecord[]> {
  const response = await api.get<ReportRecord[]>(`/reports/project/${projectId}`);
  return response.data;
}

export async function getReportById(reportId: string): Promise<ReportDetails> {
  const response = await api.get<ReportDetails>(`/reports/${reportId}`);
  return response.data;
}

export async function createReport(data: CreateReportPayload): Promise<ReportRecord> {
  const response = await api.post<ReportRecord>('/reports', data);
  return response.data;
}

export async function addChartToReport(data: AddReportChartPayload): Promise<ReportChartRecord> {
  const response = await api.post<ReportChartRecord>('/reports/add-chart', data);
  return response.data;
}

export async function reorderReportChart(data: ReorderReportChartPayload): Promise<ReportChartRecord> {
  const response = await api.put<ReportChartRecord>('/reports/reorder-chart', data);
  return response.data;
}

export async function removeReportChart(id: string): Promise<void> {
  await api.delete(`/reports/remove-chart/${id}`);
}

export async function renameReport(id: string, name: string): Promise<ReportRecord> {
  const response = await api.put<ReportRecord>(`/reports/${id}`, { name });
  return response.data;
}

export async function updateChartLayout(payload: UpdateReportChartLayoutPayload): Promise<ReportChartRecord> {
  const response = await api.put<ReportChartRecord>('/reports/update-chart-layout', payload);
  return response.data;
}

const reportService = {
  getReportsByProject,
  getReportById,
  createReport,
  addChartToReport,
  reorderReportChart,
  updateChartLayout,
  removeReportChart,
  renameReport,
};

export default reportService;
