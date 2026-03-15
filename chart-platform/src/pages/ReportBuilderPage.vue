<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ProjectList, { type ProjectItem } from '../components/dashboard/ProjectList.vue'
import reportService, { type ReportDetails, type ReportRecord } from '@legacy/services/reportService'
import ReportChartRenderer from '../components/report/ReportChartRenderer.vue'
import { useProjectStore, type Project } from '@legacy/stores/projectStore'
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'

const router = useRouter()
const route = useRoute()

const projects: ProjectItem[] = [
  { id: '7441c7bc-1fdd-4f7b-91c3-3954fbec27ed', name: 'Population Trends', updatedAt: '2 hours ago' },
]

const reports = ref<ReportRecord[]>([])
const activeReportDetails = ref<ReportDetails | null>(null)
const chartsError = ref<string | null>(null)
const isSavingLayout = ref(false)

const activeProjectId = computed(() => {
  const projectIdFromRoute = route.query.projectId
  if (typeof projectIdFromRoute === 'string') {
    return projectIdFromRoute
  }
  return projects[0]?.id
})

async function loadReport(): Promise<void> {
  if (!activeProjectId.value) {
    reports.value = []
    activeReportDetails.value = null
    return
  }

  chartsError.value = null

  try {
    reports.value = await reportService.getReportsByProject(activeProjectId.value)
    
    if (reports.value.length > 0) {
      activeReportDetails.value = await reportService.getReportById(reports.value[0]!.id)
    } else {
      activeReportDetails.value = null
    }
  } catch (error) {
    console.error('Failed to load report:', error)
    chartsError.value = error instanceof Error ? error.message : 'Failed to load report.'
  }
}

async function handleUpdateLayout(payload: { id: string; width: number; height: number }) {
  if (isSavingLayout.value) return
  isSavingLayout.value = true
  try {
    const layout = activeReportDetails.value?.charts.find(c => c.id === payload.id);
    if (!layout) return;

    await reportService.updateChartLayout({
      id: payload.id,
      positionX: layout.positionX,
      positionY: layout.positionY,
      width: payload.width,
      height: payload.height
    })
    
    layout.width = payload.width
    layout.height = payload.height
  } catch (err) {
    console.error('Failed to save layout:', err)
  } finally {
    isSavingLayout.value = false
  }
}

onMounted(async () => {
  await loadReport()
})

watch(activeProjectId, () => {
  loadReport()
})

function createNewProject(): void {
  alert('Not implemented yet')
}

const isExporting = ref(false)

async function exportToPdf() {
  if (!activeReportDetails.value || isExporting.value) return
  
  isExporting.value = true
  try {
    const reportId = activeReportDetails.value.id
    const response = await fetch(`/api/reports/${reportId}/export-pdf`, {
      method: 'GET',
    })
    
    if (response.ok) {
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${activeReportDetails.value.name}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a) // Clean up
      window.URL.revokeObjectURL(url)
    } else {
      alert('Failed to save PDF. Please ensure you have at least one chart in your report.')
    }
  } catch (err) {
    console.error('Export error:', err)
    alert('An error occurred while saving the PDF.')
  } finally {
    isExporting.value = false
  }
}

async function exportReportToPDF() {
  if (!activeReportDetails.value || isExporting.value) return
  
  isExporting.value = true
  try {
    const element = document.getElementById('report-container')
    if (!element) throw new Error('Report container not found')

    // Wait for D3 charts to be fully rendered
    await new Promise(resolve => setTimeout(resolve, 1500))

    const canvas = await html2canvas(element, {
      scale: 2, // High resolution
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    const pdfWidth = pdf.internal.pageSize.getWidth()
    const pdfHeight = pdf.internal.pageSize.getHeight()
    
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight)
    const imgActualWidth = imgWidth * ratio
    const imgActualHeight = imgHeight * ratio
    
    // Multi-page logic
    let heightLeft = imgActualHeight
    let position = 0
    let pageNumber = 1

    while (heightLeft > 0) {
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, imgActualHeight, undefined, 'FAST')
      heightLeft -= pdfHeight
      
      if (heightLeft > 0) {
        pdf.addPage()
        position = -pdfHeight * pageNumber
        pageNumber++
      }
    }

    const date = new Date().toISOString().split('T')[0].replace(/-/g, '_')
    const filename = `${activeReportDetails.value.name}_${date}.pdf`
    pdf.save(filename)
  } catch (err) {
    console.error('WYSIWYG Export error:', err)
    alert('Failed to generate WYSIWYG PDF.')
  } finally {
    isExporting.value = false
  }
}
</script>

<template>
  <main class="dashboard-page">
    <aside class="sidebar">
      <div class="sidebar__header">
        <h2>Projects</h2>
        <button type="button" class="btn btn--primary" @click="createNewProject">
          New Project
        </button>
      </div>
      <ProjectList :projects="projects" :active-project-id="activeProjectId" />
    </aside>

    <section class="charts-panel">
      <div class="charts-panel__header">
        <div>
          <h2>{{ activeReportDetails ? activeReportDetails.name : 'Report Builder' }}</h2>
          <p>Project: {{ activeProjectId || 'No project selected' }}</p>
        </div>
        <div class="header-actions">
          <button 
            type="button" 
            class="btn-secondary" 
            :disabled="isExporting || !activeReportDetails" 
            @click="exportReportToPDF"
          >
            {{ isExporting ? 'Capturing...' : 'Export Report as PDF' }}
          </button>
          <button 
            type="button" 
            class="btn-primary" 
            :disabled="isExporting || !activeReportDetails" 
            @click="exportToPdf"
          >
            {{ isExporting ? 'Saving...' : 'Save as PDF' }}
          </button>
        </div>
      </div>

      <p v-if="chartsError" class="charts-panel__error">{{ chartsError }}</p>
      
      <div v-else-if="activeReportDetails" id="report-container" class="report-wrapper">
        <div class="report-header-capture">
          <h3>{{ activeReportDetails.name }}</h3>
          <p>Project: {{ activeProjectId }}</p>
          <p class="timestamp">Generated on: {{ new Date().toLocaleDateString() }}</p>
        </div>

        <p v-if="!activeReportDetails.charts?.length" class="charts-panel__status">No charts added to report yet.</p>

        <div v-else class="report-flow">
          <ReportChartRenderer
            v-for="layout in activeReportDetails.charts"
            :key="layout.id"
            :layout="layout"
            @update-layout="handleUpdateLayout"
          />
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  height: calc(100vh - 56px);
  background: #f8fafc;
}

.sidebar {
  width: 280px;
  background: #ffffff;
  border-right: 1px solid #e2e8f0;
  display: flex;
  flex-direction: column;
}

.sidebar__header {
  padding: 16px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.sidebar__header h2 {
  margin: 0;
  font-size: 1.125rem;
  font-weight: 600;
  color: #1e293b;
}

.charts-panel {
  flex: 1;
  padding: 24px;
  overflow-y: auto;
}

.charts-panel__header {
  margin-bottom: 24px;
}

.charts-panel__header h2 {
  margin: 0 0 4px;
  font-size: 1.5rem;
  color: #0f172a;
}

.charts-panel__header p {
  margin: 0;
  font-size: 0.875rem;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.btn-primary {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 500;
  transition: opacity 0.2s;
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.charts-panel__status {
  color: #64748b;
  font-style: italic;
  padding: 24px;
  background: #ffffff;
  border-radius: 8px;
  border: 1px dashed #cbd5e1;
  text-align: center;
}

.charts-panel__error {
  color: #dc2626;
}

.report-flow {
  display: flex;
  flex-direction: column;
  gap: 32px;
  align-items: center;
  max-width: 900px;
  margin: 0 auto;
}

.report-flow > * {
  width: 100% !important;
  max-width: 100%;
}

.report-wrapper {
  background: white;
  padding: 40px;
  border-radius: 8px;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
}

.report-header-capture {
  text-align: center;
  margin-bottom: 40px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 20px;
}

.report-header-capture h3 {
  font-size: 2rem;
  margin: 0;
  color: #0f172a;
}

.report-header-capture p {
  margin: 8px 0 0;
  color: #64748b;
}

.report-header-capture .timestamp {
  font-size: 0.875rem;
  font-style: italic;
}

@media (max-width: 1024px) {
  .report-flow > * {
    height: auto !important;
    min-height: 300px;
  }
}
</style>
