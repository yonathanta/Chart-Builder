import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export interface Chart {
    id: string
    name: string
    type: string
    config: any
    dataset: any
    projectId: string
    createdAt: number
}

export interface Project {
    id: string
    name: string
    createdAt: number
}

export interface Dashboard {
    id: string
    name: string
    projectId: string
    layout: any[] // 12-column grid layout items
    createdAt: number
}

export interface ReportBlock {
    id: string
    type: 'header' | 'text' | 'chart' | 'image' | 'video'
    content: string // text or header content
    chartId?: string
}

export interface ReportPage {
    id: string
    blocks: ReportBlock[]
}

export interface Report {
    id: string
    name: string
    projectId: string
    pages: ReportPage[]
    createdAt: number
}

export const useProjectStore = defineStore('projects', () => {
    const projects = ref<Project[]>([])
    const currentProject = ref<Project | null>(null)
    const charts = ref<Chart[]>([])
    const dashboards = ref<Dashboard[]>([])
    const reports = ref<Report[]>([])

    // Load from localStorage on initialization
    const savedProjects = localStorage.getItem('projects')
    const savedCharts = localStorage.getItem('charts')
    const savedDashboards = localStorage.getItem('dashboards')
    const savedReports = localStorage.getItem('reports')
    const savedCurrentProjectId = localStorage.getItem('currentProjectId')

    if (savedProjects) {
        projects.value = JSON.parse(savedProjects)
    }

    if (savedCharts) {
        charts.value = JSON.parse(savedCharts)
    }

    if (savedDashboards) {
        dashboards.value = JSON.parse(savedDashboards)
    }

    if (savedReports) {
        reports.value = JSON.parse(savedReports)
    }

    if (savedCurrentProjectId && projects.value.length > 0) {
        const found = projects.value.find(p => p.id === savedCurrentProjectId)
        if (found) currentProject.value = found
    }

    // Watch for changes and persist
    watch(projects, (newProjects) => {
        localStorage.setItem('projects', JSON.stringify(newProjects))
    }, { deep: true })

    watch(charts, (newCharts) => {
        localStorage.setItem('charts', JSON.stringify(newCharts))
    }, { deep: true })

    watch(dashboards, (newDashboards) => {
        localStorage.setItem('dashboards', JSON.stringify(newDashboards))
    }, { deep: true })

    watch(reports, (newReports) => {
        localStorage.setItem('reports', JSON.stringify(newReports))
    }, { deep: true })

    watch(currentProject, (newProject) => {
        if (newProject) {
            localStorage.setItem('currentProjectId', newProject.id)
        } else {
            localStorage.removeItem('currentProjectId')
        }
    }, { deep: true })

    const createProject = (name: string) => {
        const newProject: Project = {
            id: crypto.randomUUID(),
            name,
            createdAt: Date.now()
        }
        projects.value.push(newProject)
        currentProject.value = newProject
        return newProject
    }

    const saveChart = (name: string, type: string, config: any, dataset: any) => {
        if (!currentProject.value) {
            throw new Error('No project selected')
        }

        const newChart: Chart = {
            id: crypto.randomUUID(),
            name,
            type,
            config,
            dataset,
            projectId: currentProject.value.id,
            createdAt: Date.now()
        }

        charts.value.push(newChart)
        return newChart
    }

    const saveDashboard = (name: string, layout: any[]) => {
        if (!currentProject.value) {
            throw new Error('No project selected')
        }

        const newDashboard: Dashboard = {
            id: crypto.randomUUID(),
            name,
            projectId: currentProject.value.id,
            layout,
            createdAt: Date.now()
        }

        dashboards.value.push(newDashboard)
        return newDashboard
    }

    const saveReport = (name: string, pages: ReportPage[], id?: string) => {
        if (!currentProject.value) {
            throw new Error('No project selected')
        }

        const reportId = id || crypto.randomUUID()
        const existingIndex = reports.value.findIndex(r => r.id === reportId)

        const existingReport = existingIndex >= 0 ? reports.value[existingIndex] : null
        const reportData: Report = {
            id: reportId,
            name,
            projectId: currentProject.value.id,
            pages,
            createdAt: existingReport ? existingReport.createdAt : Date.now()
        }

        if (existingIndex >= 0) {
            reports.value[existingIndex] = reportData
        } else {
            reports.value.push(reportData)
        }

        return reportData
    }

    const loadChartsByProject = (projectId: string) => {
        return charts.value.filter(chart => chart.projectId === projectId)
    }

    const loadDashboardsByProject = (projectId: string) => {
        return dashboards.value.filter(d => d.projectId === projectId)
    }

    const loadReportsByProject = (projectId: string) => {
        return reports.value.filter(r => r.projectId === projectId)
    }

    const selectProject = (projectId: string) => {
        const project = projects.value.find(p => p.id === projectId)
        if (project) {
            currentProject.value = project
        }
    }

    return {
        projects,
        currentProject,
        charts,
        dashboards,
        reports,
        createProject,
        saveChart,
        saveDashboard,
        saveReport,
        loadChartsByProject,
        loadDashboardsByProject,
        loadReportsByProject,
        selectProject
    }
})
