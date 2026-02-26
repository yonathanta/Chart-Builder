<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore, type Chart } from '../stores/projectStore'
import ChartRenderer from '../components/ChartRenderer.vue'

const projectStore = useProjectStore()
const currentDashboard = ref<{
  name: string;
  layout: any[];
}>({
  name: 'New Dashboard',
  layout: []
})

const availableCharts = computed(() => {
  if (!projectStore.currentProject) return []
  return projectStore.loadChartsByProject(projectStore.currentProject.id)
})

const dashboardName = ref('New Dashboard')

function addChartToDashboard(chart: any) {
  const newItem = {
    id: crypto.randomUUID(),
    chartId: chart.id,
    x: 0,
    y: (currentDashboard.value.layout.length * 4) % 12, // Simple stacking
    w: 6,
    h: 4
  }
  currentDashboard.value.layout.push(newItem)
}

function handleSaveDashboard() {
  if (!projectStore.currentProject) {
    alert('Select a project first!')
    return
  }
  projectStore.saveDashboard(dashboardName.value, currentDashboard.value.layout)
  alert('Dashboard saved!')
}

// Drag and drop logic (simplified)
const draggedItem = ref<any>(null)

function onDragStart(item: any, event: DragEvent) {
  draggedItem.value = item
  if (event.dataTransfer) {
    event.dataTransfer.setData('text/plain', item.id)
    event.dataTransfer.effectAllowed = 'move'
  }
}

function onDrop(event: DragEvent) {
  event.preventDefault()
  if (!draggedItem.value) return

  const grid = event.currentTarget as HTMLElement
  const rect = grid.getBoundingClientRect()
  const cellWidth = rect.width / 12
  const cellHeight = 100 // Custom row height

  const x = Math.floor((event.clientX - rect.left) / cellWidth)
  const y = Math.floor((event.clientY - rect.top) / cellHeight)

  // Snap to grid
  draggedItem.value.x = Math.max(0, Math.min(12 - draggedItem.value.w, x))
  draggedItem.value.y = Math.max(0, y)
  draggedItem.value = null
}

function removeItem(id: string) {
  currentDashboard.value.layout = currentDashboard.value.layout.filter(i => i.id !== id)
}

function resizeItem(item: any, dw: number, dh: number) {
  item.w = Math.max(1, Math.min(12 - item.x, item.w + dw))
  item.h = Math.max(1, item.h + dh)
}
</script>

<template>
  <div class="dashboard-builder">
    <aside class="sidebar">
      <div class="sidebar-header">
        <h3 class="panel__title">Available Charts</h3>
        <p class="muted" v-if="!projectStore.currentProject">Select a project in Chart Builder first</p>
      </div>
      <div class="chart-list">
        <div v-for="chart in availableCharts" :key="chart.id" class="chart-item" @click="addChartToDashboard(chart)">
          <div class="chart-name">{{ chart.name }}</div>
          <div class="chart-type">{{ chart.type }}</div>
        </div>
        <p v-if="projectStore.currentProject && availableCharts.length === 0" class="muted">No charts saved in this project yet.</p>
      </div>
    </aside>

    <main class="builder-area">
      <header class="builder-header">
        <input type="text" v-model="dashboardName" class="dashboard-name-input" placeholder="Dashboard Name" />
        <div class="builder-actions">
           <button class="btn btn--primary" @click="handleSaveDashboard">Save Dashboard</button>
        </div>
      </header>

      <div class="grid-container" @dragover.prevent @drop="onDrop">
        <div class="grid-background">
          <div v-for="i in 12" :key="i" class="grid-col"></div>
        </div>
        
        <div 
          v-for="item in currentDashboard.layout" 
          :key="item.id"
          class="layout-item"
          :style="{
            gridColumn: `${item.x + 1} / span ${item.w}`,
            gridRow: `${item.y + 1} / span ${item.h}`
          }"
          draggable="true"
          @dragstart="onDragStart(item, $event)"
        >
          <div class="item-controls">
            <span class="item-title">{{ projectStore.charts.find((c: Chart) => c.id === item.chartId)?.name }}</span>
            <div class="control-group">
                <div class="resize-controls">
                  <button @click.stop="resizeItem(item, -1, 0)" class="control-btn" title="Decrease Width">W-</button>
                  <button @click.stop="resizeItem(item, 1, 0)" class="control-btn" title="Increase Width">W+</button>
                  <button @click.stop="resizeItem(item, 0, -1)" class="control-btn" title="Decrease Height">H-</button>
                  <button @click.stop="resizeItem(item, 0, 1)" class="control-btn" title="Increase Height">H+</button>
                </div>
                <button @click.stop="removeItem(item.id)" class="control-btn delete" title="Remove">×</button>
            </div>
          </div>
          <div class="item-content">
            <ChartRenderer v-if="projectStore.charts.find((c: Chart) => c.id === item.chartId)" :chart="projectStore.charts.find((c: Chart) => c.id === item.chartId)!" />
          </div>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.dashboard-builder {
  display: flex;
  height: calc(100vh - var(--nav-height));
  background: #f8fafc;
}

.sidebar {
  width: 300px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.sidebar-header {
  padding: 24px;
  border-bottom: 1px solid #e2e8f0;
}

.chart-list {
  padding: 16px;
  flex: 1;
  overflow-y: auto;
}

.chart-item {
  padding: 12px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-item:hover {
  background: #e2e8f0;
  border-color: #cbd5e1;
  transform: translateY(-2px);
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
}

.chart-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.95rem;
}

.chart-type {
  font-size: 0.7rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.025em;
  margin-top: 4px;
}

.builder-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 24px;
  overflow-y: auto;
}

.builder-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.dashboard-name-input {
  font-size: 1.5rem;
  font-weight: 700;
  border: none;
  background: transparent;
  color: #1e293b;
  border-bottom: 2px solid transparent;
  padding: 4px 0;
  width: 300px;
}

.dashboard-name-input:focus {
  outline: none;
  border-bottom-color: #2563eb;
}

.grid-container {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-auto-rows: 100px;
  gap: 16px;
  background: white;
  min-height: 800px;
  padding: 24px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  position: relative;
  box-shadow: inset 0 2px 4px 0 rgba(0, 0, 0, 0.05);
}

.grid-background {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: 16px;
  padding: 24px;
  pointer-events: none;
  z-index: 0;
}

.grid-col {
  border-left: 1px dashed #f1f5f9;
}

.grid-col:last-child {
  border-right: 1px dashed #f1f5f9;
}

.layout-item {
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
  position: relative;
  z-index: 10;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: box-shadow 0.2s, border-color 0.2s;
}

.layout-item:hover {
  border-color: #2563eb;
  box-shadow: 0 10px 15px -3px rgba(37, 99, 235, 0.1), 0 4px 6px -2px rgba(37, 99, 235, 0.05);
}

.item-controls {
  padding: 8px 12px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  opacity: 0;
  transition: opacity 0.2s;
}

.layout-item:hover .item-controls {
  opacity: 1;
}

.item-title {
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 150px;
}

.control-group {
    display: flex;
    gap: 12px;
    align-items: center;
}

.resize-controls {
  display: flex;
  gap: 4px;
}

.control-btn {
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid #e2e8f0;
  background: white;
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 600;
  color: #64748b;
  transition: all 0.2s;
}

.control-btn:hover {
  background: #f1f5f9;
  border-color: #cbd5e1;
  color: #1e293b;
}

.control-btn.delete {
  color: #ef4444;
  border-color: #fee2e2;
  font-size: 1rem;
  line-height: 1;
}

.control-btn.delete:hover {
  background: #fef2f2;
  border-color: #fecaca;
  color: #dc2626;
}

.item-content {
  flex: 1;
  padding: 12px;
  position: relative;
  min-height: 0;
}

.muted {
  color: #94a3b8;
  font-size: 0.875rem;
}
</style>
