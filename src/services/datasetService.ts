import api from './api'

export type DatasetRecord = {
  id: string
  name: string
  description?: string
  projectId: string
  dataJson: string
  sourceType: string
  createdAt: string
}

export type CreateDatasetPayload = {
  name: string
  description?: string
  projectId: string
  dataJson: string
  sourceType: string
}

export type UpdateDatasetPayload = {
  name: string
  description?: string
  dataJson: string
  sourceType: string
}

export async function getDatasetsByProject(projectId: string): Promise<DatasetRecord[]> {
  const response = await api.get<DatasetRecord[]>(`/datasets/project/${projectId}`)
  return response.data
}

export async function getDataset(datasetId: string): Promise<DatasetRecord> {
  const response = await api.get<DatasetRecord>(`/datasets/${datasetId}`)
  return response.data
}

export async function createDataset(data: CreateDatasetPayload): Promise<DatasetRecord> {
  const response = await api.post<DatasetRecord>('/datasets', data)
  return response.data
}

export async function updateDataset(datasetId: string, data: UpdateDatasetPayload): Promise<DatasetRecord> {
  const response = await api.put<DatasetRecord>(`/datasets/${datasetId}`, data)
  return response.data
}

export async function deleteDataset(datasetId: string): Promise<void> {
  await api.delete(`/datasets/${datasetId}`)
}

export async function uploadDataset(formData: FormData): Promise<DatasetRecord> {
  const response = await api.post<DatasetRecord>('/datasets/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })

  return response.data
}

const datasetService = {
  getDatasetsByProject,
  getDataset,
  createDataset,
  updateDataset,
  deleteDataset,
  uploadDataset,
}

export default datasetService
