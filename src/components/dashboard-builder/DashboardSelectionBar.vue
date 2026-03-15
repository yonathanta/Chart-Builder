<script setup lang="ts">
import type { DashboardRecord } from '../../services/dashboardService'
import type { ProjectRecord } from '../../services/projectService'

defineProps<{
  projects: ProjectRecord[]
  dashboards: DashboardRecord[]
  selectedProjectId: string
  selectedDashboardId: string
  loading: boolean
}>()

const emit = defineEmits<{
  (event: 'update:selectedProjectId', value: string): void
  (event: 'update:selectedDashboardId', value: string): void
}>()
</script>

<template>
  <section class="selection-bar">
    <div class="field">
      <label>Project</label>
      <select
        :value="selectedProjectId"
        :disabled="loading || projects.length === 0"
        @change="emit('update:selectedProjectId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select a project</option>
        <option v-for="project in projects" :key="project.id" :value="project.id">
          {{ project.name }}
        </option>
      </select>
    </div>

    <div class="field">
      <label>Dashboard</label>
      <select
        :value="selectedDashboardId"
        :disabled="loading || dashboards.length === 0"
        @change="emit('update:selectedDashboardId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select a dashboard</option>
        <option v-for="dashboard in dashboards" :key="dashboard.id" :value="dashboard.id">
          {{ dashboard.name }}
        </option>
      </select>
    </div>
  </section>
</template>

<style scoped>
.selection-bar {
  display: grid;
  grid-template-columns: repeat(2, minmax(220px, 320px));
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

label {
  color: #475569;
  font-size: 13px;
  font-weight: 600;
}

select {
  height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}
</style>
