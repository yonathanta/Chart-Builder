<script setup lang="ts">
export interface ProjectItem {
  id: string
  name: string
  updatedAt: string
}

defineProps<{
  projects: ProjectItem[]
}>()
</script>

<template>
  <section class="project-list-section">
    <h2>Recent Projects</h2>
    <ul class="project-list">
      <li v-for="project in projects" :key="project.id" class="project-card">
        <RouterLink :to="`/project/${project.id}`" class="project-link">
          <span class="project-name">{{ project.name }}</span>
          <span class="project-updated">Updated {{ project.updatedAt }}</span>
        </RouterLink>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.project-list-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.project-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}

.project-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
}

.project-link {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  text-decoration: none;
  color: #111827;
}

.project-name {
  font-weight: 600;
}

.project-updated {
  font-size: 0.875rem;
  color: #6b7280;
}
</style>
