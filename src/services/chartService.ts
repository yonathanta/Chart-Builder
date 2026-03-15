import api from "./api";

type ChartLike = {
  projectId?: string;
  ProjectId?: string;
  [key: string]: unknown;
};

export type CreateChartData = {
  name: string;
  chartType: string;
  configJson: string;
  styleJson: string;
  datasetId: string;
  projectId: string;
};

export type UpdateChartData = Omit<CreateChartData, "projectId">;

export async function getCharts(projectId: string): Promise<unknown> {
  const response = await api.get<ChartLike[]>(`/charts/project/${projectId}`);
  return response.data;
}

export async function getChart(id: string): Promise<unknown> {
  const response = await api.get(`/charts/${id}`);
  return response.data;
}

export async function createChart(data: CreateChartData): Promise<unknown> {
  const response = await api.post("/charts", data);
  return response.data;
}

export async function updateChart(id: string, data: UpdateChartData): Promise<unknown> {
  const response = await api.put(`/charts/${id}`, data);
  return response.data;
}

export async function deleteChart(id: string): Promise<unknown> {
  const response = await api.delete(`/charts/${id}`);
  return response.data;
}

const chartService = {
  getCharts,
  getChart,
  createChart,
  updateChart,
  deleteChart,
};

export default chartService;