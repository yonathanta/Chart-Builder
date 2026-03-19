import api from './api'

const LOCAL_DATASETS_KEY = 'chartBuilder:datasets:local-v1'

export type DatasetRecord = {
  id: string
  name: string
  description?: string
  projectId: string
  dataJson: string
  sourceType: string
  createdAt: string
  updatedAt?: string
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

function readLocalDatasets(): DatasetRecord[] {
  try {
    const raw = localStorage.getItem(LOCAL_DATASETS_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((item) => typeof item === 'object' && item !== null) as DatasetRecord[]
  } catch {
    return []
  }
}

function writeLocalDatasets(datasets: DatasetRecord[]): void {
  localStorage.setItem(LOCAL_DATASETS_KEY, JSON.stringify(datasets))
}

function createLocalId(): string {
  return `local-${Math.random().toString(36).slice(2, 10)}-${Date.now()}`
}

export async function getDatasetsByProject(projectId: string): Promise<DatasetRecord[]> {
  try {
    const response = await api.get<DatasetRecord[]>(`/datasets/project/${projectId}`)
    return response.data
  } catch {
    return readLocalDatasets().filter((dataset) => dataset.projectId === projectId)
  }
}

export async function getDataset(datasetId: string): Promise<DatasetRecord> {
  try {
    const response = await api.get<DatasetRecord>(`/datasets/${datasetId}`)
    return response.data
  } catch {
    const localDataset = readLocalDatasets().find((dataset) => dataset.id === datasetId)
    if (!localDataset) {
      throw new Error('Dataset not found.')
    }
    return localDataset
  }
}

export async function createDataset(data: CreateDatasetPayload): Promise<DatasetRecord> {
  try {
    const response = await api.post<DatasetRecord>('/datasets', data)
    return response.data
  } catch {
    const now = new Date().toISOString()
    const created: DatasetRecord = {
      id: createLocalId(),
      name: data.name,
      description: data.description,
      projectId: data.projectId,
      dataJson: data.dataJson,
      sourceType: data.sourceType,
      createdAt: now,
      updatedAt: now,
    }

    const all = readLocalDatasets()
    writeLocalDatasets([created, ...all])
    return created
  }
}

export async function updateDataset(datasetId: string, data: UpdateDatasetPayload): Promise<DatasetRecord> {
  try {
    const response = await api.put<DatasetRecord>(`/datasets/${datasetId}`, data)
    return response.data
  } catch {
    const all = readLocalDatasets()
    const index = all.findIndex((dataset) => dataset.id === datasetId)
    if (index < 0) {
      throw new Error('Dataset not found.')
    }

    const current = all[index]
    const updated: DatasetRecord = {
      ...current,
      name: data.name,
      description: data.description,
      dataJson: data.dataJson,
      sourceType: data.sourceType,
      updatedAt: new Date().toISOString(),
    }

    all[index] = updated
    writeLocalDatasets(all)
    return updated
  }
}

export async function deleteDataset(datasetId: string): Promise<void> {
  try {
    await api.delete(`/datasets/${datasetId}`)
  } catch {
    const all = readLocalDatasets()
    writeLocalDatasets(all.filter((dataset) => dataset.id !== datasetId))
  }
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
