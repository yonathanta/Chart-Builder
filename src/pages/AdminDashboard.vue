<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'
import adminService, { type AdminUser, type AuditLogItem } from '../services/adminService'

const router = useRouter()
const authStore = useAuthStore()

const users = ref<AdminUser[]>([])
const auditLogs = ref<AuditLogItem[]>([])
const isLoadingUsers = ref(false)
const isLoadingLogs = ref(false)
const errorMessage = ref('')

const roleOptions = ['SuperAdmin', 'Admin', 'Statistician', 'Reviewer', 'Viewer']

const hasAdminAccess = computed(() => {
  const role = authStore.userRole.toLowerCase()
  return role === 'admin' || role === 'superadmin'
})

async function loadUsers(): Promise<void> {
  isLoadingUsers.value = true
  errorMessage.value = ''

  try {
    users.value = await adminService.getUsers()
  } catch (error) {
    console.error('Failed to load users', error)
    errorMessage.value = 'Failed to load users.'
  } finally {
    isLoadingUsers.value = false
  }
}

async function loadAuditLogs(): Promise<void> {
  isLoadingLogs.value = true

  try {
    auditLogs.value = await adminService.getAuditLogs()
  } catch (error) {
    console.error('Failed to load audit logs', error)
    errorMessage.value = 'Failed to load audit logs.'
  } finally {
    isLoadingLogs.value = false
  }
}

async function changeUserRole(user: AdminUser, role: string): Promise<void> {
  try {
    const updated = await adminService.updateUserRole(user.id, role)
    user.role = updated.role
  } catch (error) {
    console.error('Failed to update role', error)
    errorMessage.value = 'Failed to update user role.'
  }
}

async function toggleUserStatus(user: AdminUser): Promise<void> {
  try {
    const updated = await adminService.updateUserStatus(user.id, !user.isActive)
    user.isActive = updated.isActive
  } catch (error) {
    console.error('Failed to update status', error)
    errorMessage.value = 'Failed to update user status.'
  }
}

function formatDate(value: string): string {
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString()
}

onMounted(async () => {
  if (!hasAdminAccess.value) {
    await router.replace('/dashboard')
    return
  }

  await Promise.all([loadUsers(), loadAuditLogs()])
})
</script>

<template>
  <main class="admin-page">
    <header class="admin-header">
      <h1>Admin Dashboard</h1>
      <p>Manage users and review audit logs.</p>
    </header>

    <p v-if="errorMessage" class="error-text">{{ errorMessage }}</p>

    <section class="panel">
      <h2>Users</h2>
      <p v-if="isLoadingUsers" class="muted">Loading users...</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Email</th>
            <th>Name</th>
            <th>Role</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in users" :key="user.id">
            <td>{{ user.email }}</td>
            <td>{{ user.fullName || '-' }}</td>
            <td>
              <select :value="user.role" @change="changeUserRole(user, ($event.target as HTMLSelectElement).value)">
                <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
              </select>
            </td>
            <td>{{ user.isActive ? 'Active' : 'Inactive' }}</td>
            <td>
              <button class="btn" @click="toggleUserStatus(user)">
                {{ user.isActive ? 'Deactivate' : 'Activate' }}
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="panel">
      <h2>Audit Logs</h2>
      <p v-if="isLoadingLogs" class="muted">Loading audit logs...</p>
      <table v-else class="table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Action</th>
            <th>Entity</th>
            <th>User</th>
            <th>Old Value</th>
            <th>New Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="log in auditLogs" :key="log.id">
            <td>{{ formatDate(log.timestamp) }}</td>
            <td>{{ log.actionType }}</td>
            <td>{{ log.entityType }}</td>
            <td>{{ log.userId }}</td>
            <td class="json-cell">{{ log.oldValue || '-' }}</td>
            <td class="json-cell">{{ log.newValue || '-' }}</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
</template>

<style scoped>
.admin-page {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.admin-header h1 {
  margin: 0;
}

.admin-header p {
  margin: 6px 0 0;
  color: #64748b;
}

.panel {
  background: #fff;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 16px;
}

.table {
  width: 100%;
  border-collapse: collapse;
}

.table th,
.table td {
  border-bottom: 1px solid #e2e8f0;
  text-align: left;
  padding: 10px;
  vertical-align: top;
}

.btn {
  border: 1px solid #cbd5e1;
  background: #fff;
  border-radius: 6px;
  height: 32px;
  padding: 0 10px;
  cursor: pointer;
}

.muted {
  color: #64748b;
}

.error-text {
  color: #dc2626;
}

.json-cell {
  max-width: 320px;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
}
</style>
