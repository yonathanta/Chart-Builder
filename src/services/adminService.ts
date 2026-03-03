import api from "./api";

export type AdminUser = {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
};

export type AuditLogItem = {
  id: string;
  userId: string;
  actionType: string;
  entityType: string;
  entityId: string;
  timestamp: string;
  oldValue?: string | null;
  newValue?: string | null;
};

export type AdminProject = {
  id: string;
  name: string;
  description?: string;
  userId: string;
  createdAt?: string;
  updatedAt?: string;
  memberCount?: number;
};

export async function getUsers(): Promise<AdminUser[]> {
  const response = await api.get<AdminUser[]>('/admin/users');
  return response.data;
}

export async function updateUserRole(id: string, role: string): Promise<AdminUser> {
  const response = await api.put<AdminUser>(`/admin/users/${id}/role`, { role });
  return response.data;
}

export async function updateUserStatus(id: string, isActive: boolean): Promise<AdminUser> {
  const response = await api.put<AdminUser>(`/admin/users/${id}/status`, { isActive });
  return response.data;
}

export async function getAuditLogs(): Promise<AuditLogItem[]> {
  const response = await api.get<AuditLogItem[]>('/admin/audit-logs');
  return response.data;
}

export async function getProjects(): Promise<AdminProject[]> {
  const response = await api.get<AdminProject[]>('/admin/projects');
  return response.data;
}

const adminService = {
  getUsers,
  updateUserRole,
  updateUserStatus,
  getAuditLogs,
  getProjects,
};

export default adminService;