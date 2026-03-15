<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectRecord } from '../../services/projectService'
import type { ReportRecord } from '../../services/reportService'

defineProps<{
  projects: ProjectRecord[]
  reports: ReportRecord[]
  selectedProjectId: string
  selectedReportId: string
  loading: boolean
}>()

const emit = defineEmits<{
  (event: 'update:selectedProjectId', value: string): void
  (event: 'update:selectedReportId', value: string): void
  (event: 'createReport', name: string): void
}>()

const newReportName = ref('')

function createReport(): void {
  const name = newReportName.value.trim()
  if (!name) {
    return
  }

  emit('createReport', name)
  newReportName.value = ''
}
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
      <label>Report</label>
      <select
        :value="selectedReportId"
        :disabled="loading || reports.length === 0"
        @change="emit('update:selectedReportId', ($event.target as HTMLSelectElement).value)"
      >
        <option value="" disabled>Select a report</option>
        <option v-for="report in reports" :key="report.id" :value="report.id">
          {{ report.name }}
        </option>
      </select>
    </div>

    <div class="field field--create">
      <label>New report</label>
      <div class="create-row">
        <input
          v-model="newReportName"
          type="text"
          placeholder="Quarterly Report"
          :disabled="loading || !selectedProjectId"
          @keyup.enter="createReport"
        />
        <button class="create-btn" :disabled="loading || !selectedProjectId || !newReportName.trim()" @click="createReport">
          Create
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.selection-bar {
  display: grid;
  grid-template-columns: repeat(3, minmax(220px, 360px));
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

select,
input {
  height: 38px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 0 10px;
  background: #fff;
}

.field--create {
  min-width: 260px;
}

.create-row {
  display: grid;
  grid-template-columns: minmax(140px, 1fr) auto;
  gap: 8px;
}

.create-btn {
  height: 38px;
  border: 1px solid #2563eb;
  border-radius: 8px;
  background: #2563eb;
  color: #fff;
  padding: 0 14px;
  cursor: pointer;
}

.create-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
