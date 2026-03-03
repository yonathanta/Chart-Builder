import api from "./api";

export type ReportRecord = {
  id: string;
  title: string;
  metadataJson: string;
  layoutJson: string;
  projectId: string;
  createdAt: string;
  updatedAt: string;
};

export type SaveReportPayload = {
  title: string;
  metadataJson: string;
  layoutJson: string;
  projectId: string;
};

export async function getReports(projectId: string): Promise<ReportRecord[]> {
  const response = await api.get<ReportRecord[]>(`/reports?projectId=${projectId}`);
  return response.data;
}

export async function createReport(data: SaveReportPayload): Promise<ReportRecord> {
  const response = await api.post<ReportRecord>('/reports', data);
  return response.data;
}

export async function updateReport(id: string, data: SaveReportPayload): Promise<ReportRecord> {
  const response = await api.put<ReportRecord>(`/reports/${id}`, data);
  return response.data;
}

const reportService = {
  getReports,
  createReport,
  updateReport,
};

export default reportService;
