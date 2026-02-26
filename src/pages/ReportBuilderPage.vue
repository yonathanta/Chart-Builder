<script setup lang="ts">
import { ref, computed } from 'vue'
import { useProjectStore, type ReportBlock, type Chart, type Report } from '../stores/projectStore'
import ReportTitleBlock from '../components/ReportBlocks/ReportTitleBlock.vue'
import ReportTextBlock from '../components/ReportBlocks/ReportTextBlock.vue'
import ReportChartBlock from '../components/ReportBlocks/ReportChartBlock.vue'

const projectStore = useProjectStore()
const currentReportId = ref<string | null>(null)
const reportName = ref('New Report')
const blocks = ref<ReportBlock[]>([])

const availableCharts = computed(() => {
  if (!projectStore.currentProject) return []
  return projectStore.loadChartsByProject(projectStore.currentProject.id)
})

const savedReports = computed(() => {
  if (!projectStore.currentProject) return []
  return projectStore.loadReportsByProject(projectStore.currentProject.id)
})

function createNewReport() {
  currentReportId.value = null
  reportName.value = 'New Report'
  blocks.value = []
}

function loadReport(report: Report) {
  currentReportId.value = report.id
  reportName.value = report.name
  // Deep copy blocks to avoid direct mutation of store state before saving
  blocks.value = JSON.parse(JSON.stringify(report.blocks))
}

function addHeader() {
  blocks.value.push({
    id: crypto.randomUUID(),
    type: 'header',
    content: 'New Section'
  })
}

function addText() {
  blocks.value.push({
    id: crypto.randomUUID(),
    type: 'text',
    content: ''
  })
}

function addChart(chart: Chart) {
  blocks.value.push({
    id: crypto.randomUUID(),
    type: 'chart',
    content: '',
    chartId: chart.id
  })
}

function removeBlock(id: string) {
  blocks.value = blocks.value.filter(b => b.id !== id)
}

function moveBlock(index: number, direction: 'up' | 'down') {
  const newIndex = direction === 'up' ? index - 1 : index + 1
  if (newIndex < 0 || newIndex >= blocks.value.length) return
  
  const block = blocks.value[index]
  const otherBlock = blocks.value[newIndex]
  if (!block || !otherBlock) return

  blocks.value[index] = otherBlock
  blocks.value[newIndex] = block
}

function handleSaveReport() {
  if (!projectStore.currentProject) {
    alert('Select a project first!')
    return
  }
  const saved = projectStore.saveReport(reportName.value, blocks.value, currentReportId.value || undefined)
  currentReportId.value = saved.id
  alert('Report saved!')
}
</script>

<template>
  <div class="report-builder">
    <aside class="sidebar">
      <div class="sidebar-section">
        <button class="btn btn--primary block-btn" @click="createNewReport">+ Create New Report</button>
      </div>

      <div class="sidebar-section">
        <h3 class="panel__title">My Reports</h3>
        <div class="report-list">
          <div 
            v-for="report in savedReports" 
            :key="report.id" 
            class="report-list-item"
            :class="{ active: currentReportId === report.id }"
            @click="loadReport(report)"
          >
            {{ report.name }}
          </div>
          <p v-if="savedReports.length === 0" class="muted">No reports saved yet.</p>
        </div>
      </div>

      <div class="sidebar-section">
        <h3 class="panel__title">Add Content</h3>
        <div class="action-list">
          <button class="btn btn--outline block-btn" @click="addHeader">+ Add Title Section</button>
          <button class="btn btn--outline block-btn" @click="addText">+ Add Text Section</button>
        </div>
      </div>

      <div class="sidebar-section charts-section">
        <h3 class="panel__title">Available Charts</h3>
        <p class="muted" v-if="!projectStore.currentProject">Select a project first</p>
        <div class="chart-list">
          <div v-for="chart in availableCharts" :key="chart.id" class="chart-item" @click="addChart(chart)">
            <div class="chart-name">{{ chart.name }}</div>
            <div class="chart-type">{{ chart.type }}</div>
          </div>
        </div>
      </div>
    </aside>

    <main class="builder-area">
      <header class="builder-header">
        <input type="text" v-model="reportName" class="report-name-input" placeholder="Report Name" />
        <div class="header-actions">
           <span v-if="currentReportId" class="status-badge">Editing Saved Report</span>
           <button class="btn btn--primary" @click="handleSaveReport">Save Report</button>
        </div>
      </header>

      <div class="report-preview">
        <div v-for="(block, index) in blocks" :key="block.id" class="report-block">
          <div class="block-controls">
            <div class="move-btns">
              <button @click="moveBlock(index, 'up')" :disabled="index === 0" class="mini-btn">↑</button>
              <button @click="moveBlock(index, 'down')" :disabled="index === blocks.length - 1" class="mini-btn">↓</button>
            </div>
            <button class="delete-btn" @click="removeBlock(block.id)">×</button>
          </div>

          <div class="block-content">
            <ReportTitleBlock 
              v-if="block.type === 'header'" 
              v-model="block.content" 
            />
            <ReportTextBlock 
              v-else-if="block.type === 'text'" 
              v-model="block.content" 
            />
            <ReportChartBlock 
              v-else-if="block.type === 'chart'" 
              :chart-id="block.chartId!" 
            />
          </div>
        </div>
        
        <div v-if="blocks.length === 0" class="empty-state">
          <div class="empty-icon">📝</div>
          <p>Start building your report by adding titles, text, and charts from the sidebar.</p>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.report-builder {
  display: flex;
  height: calc(100vh - var(--nav-height));
  background: #f1f5f9;
}

.sidebar {
  width: 320px;
  background: white;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
  padding: 24px;
  box-shadow: 4px 0 15px rgba(0,0,0,0.02);
  overflow-y: auto;
}

.sidebar-section {
  margin-bottom: 32px;
}

.sidebar-section:last-child {
  margin-bottom: 0;
}

.charts-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.report-list {
  margin-top: 12px;
}

.report-list-item {
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.9rem;
  color: #475569;
  transition: all 0.2s;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-list-item:hover {
  background: #f1f5f9;
  color: #1e293b;
}

.report-list-item.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.chart-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 12px;
}

.chart-item {
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.chart-item:hover {
  border-color: #2563eb;
  background: #eff6ff;
  transform: translateX(4px);
}

.action-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 12px;
}

.block-btn {
  width: 100%;
  text-align: left;
  padding: 10px 16px;
  font-weight: 500;
}

.builder-area {
  flex: 1;
  padding: 40px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.report-preview {
  width: 100%;
  max-width: 850px;
  background: white;
  min-height: 1100px;
  padding: 80px 60px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  border-radius: 8px;
}

.report-name-input {
  font-size: 2.25rem;
  font-weight: 800;
  border: none;
  border-bottom: 2px solid transparent;
  width: 100%;
  max-width: 500px;
  margin-bottom: 40px;
  text-align: center;
  color: #0f172a;
}

.report-name-input:focus {
  outline: none;
  border-bottom-color: #2563eb;
}

.builder-header {
    width: 100%;
    max-width: 850px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 32px;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-badge {
  font-size: 0.75rem;
  background: #f1f5f9;
  color: #64748b;
  padding: 4px 12px;
  border-radius: 99px;
  font-weight: 600;
}

.report-block {
  position: relative;
  margin-bottom: 40px;
  padding: 20px;
  border: 1px solid transparent;
  border-radius: 12px;
  transition: all 0.2s;
}

.report-block:hover {
  border-color: #f1f5f9;
  background: #f8fafc;
}

.block-controls {
  position: absolute;
  right: -50px;
  top: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  opacity: 0;
  transition: opacity 0.2s;
}

.report-block:hover .block-controls {
  opacity: 1;
}

.mini-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: white;
  cursor: pointer;
  font-weight: bold;
  color: #64748b;
}

.mini-btn:hover:not(:disabled) {
  border-color: #2563eb;
  color: #2563eb;
}

.delete-btn {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #fee2e2;
  background: white;
  color: #ef4444;
  cursor: pointer;
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: #fef2f2;
}

.empty-state {
  text-align: center;
  color: #94a3b8;
  margin-top: 150px;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 16px;
}

.btn--outline {
    background: white;
    border: 1px solid #e2e8f0;
    color: #475569;
}

.btn--outline:hover {
    background: #f8fafc;
    border-color: #cbd5e1;
}

.chart-name {
  font-weight: 600;
  color: #1e293b;
  font-size: 0.9rem;
}

.chart-type {
  font-size: 0.75rem;
  color: #64748b;
  text-transform: uppercase;
  margin-top: 2px;
}

.muted {
  color: #94a3b8;
  font-size: 0.875rem;
}
</style>
