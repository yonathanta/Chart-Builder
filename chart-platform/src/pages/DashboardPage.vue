<script setup lang="ts">
import { useRouter } from 'vue-router'
import ProjectList, { type ProjectItem } from '../components/dashboard/ProjectList.vue'

const router = useRouter()

const projects: ProjectItem[] = [
  { id: 'proj-001', name: 'Population Trends 2026', updatedAt: '2 hours ago' },
  { id: 'proj-002', name: 'Regional GDP Comparison', updatedAt: 'Yesterday' },
  { id: 'proj-003', name: 'Health Access Overview', updatedAt: '3 days ago' },
]

function createNewProject(): void {
  router.push('/chart-builder')
}
</script>

<template>
  <main class="dashboard-page">
    <section class="dashboard-header">
      <div>
        <h1>Welcome back</h1>
        <p>Start a new chart project or continue working on a previous one.</p>
      </div>
      <button type="button" class="create-button" @click="createNewProject">
        Create New Project
      </button>
    </section>

    <ProjectList :projects="projects" />
  </main>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.dashboard-header h1 {
  margin: 0;
  font-size: 1.5rem;
}

.dashboard-header p {
  margin: 8px 0 0;
  color: #6b7280;
}

.create-button {
  height: 38px;
  padding: 0 14px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  background: #111827;
  color: #ffffff;
  cursor: pointer;
}
</style>
