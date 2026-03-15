import api from './api'

export type ProjectRecord = {
  id: string
  name: string
  description?: string
  userId?: string
  createdAt?: string
  updatedAt?: string
}

export type CreateProjectPayload = {
  name: string
  description?: string
}

export async function getProjects(): Promise<ProjectRecord[]> {
  const response = await api.get<ProjectRecord[]>('/projects')
  return response.data
}

export async function createProject(data: CreateProjectPayload): Promise<ProjectRecord> {
  const response = await api.post<ProjectRecord>('/projects', data)
  return response.data
}

const projectService = {
  getProjects,
  createProject,
}

export default projectService
