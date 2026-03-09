import { DashboardMetrics } from '../interfaces/dashboard-metrics.interface';

export const dashboardMetricsMock: DashboardMetrics = {
  source: 'mock',
  summary: {
    proyectosActivos: 6,
    tareasPendientes: 14,
    subtareasVencidas: 3,
    tareasTerminadas: 9
  },
  productivity: {
    byUser: [
      { userId: 12, nombre: 'Ana Rivera', tareasPendientes: 4, tareasTerminadas: 6, subtareasVencidas: 1 },
      { userId: 17, nombre: 'Luis Gómez', tareasPendientes: 5, tareasTerminadas: 2, subtareasVencidas: 2 },
      { userId: 21, nombre: 'María Torres', tareasPendientes: 5, tareasTerminadas: 1, subtareasVencidas: 0 }
    ],
    byProject: [
      { projectId: 101, nombre: 'Orbit Sales', tareasPendientes: 4, tareasTerminadas: 3, subtareasVencidas: 1 },
      { projectId: 102, nombre: 'Control Operativo', tareasPendientes: 6, tareasTerminadas: 4, subtareasVencidas: 1 },
      { projectId: 103, nombre: 'Capacitación', tareasPendientes: 4, tareasTerminadas: 2, subtareasVencidas: 1 }
    ],
    byTask: [
      { taskId: 2001, projectId: 101, userId: 12, nombre: 'Pipeline semanal', estado: 'haciendo', progreso: 60, subtareasPendientes: 2, subtareasVencidas: 1 },
      { taskId: 2002, projectId: 101, userId: 17, nombre: 'Revisión de leads', estado: 'por_hacer', progreso: 15, subtareasPendientes: 3, subtareasVencidas: 0 },
      { taskId: 2003, projectId: 102, userId: 21, nombre: 'Validación de procesos', estado: 'ocupado', progreso: 45, subtareasPendientes: 2, subtareasVencidas: 1 },
      { taskId: 2004, projectId: 102, userId: 12, nombre: 'Reporte operativo', estado: 'terminada', progreso: 100, subtareasPendientes: 0, subtareasVencidas: 0 },
      { taskId: 2005, projectId: 103, userId: 17, nombre: 'Plan de capacitación', estado: 'haciendo', progreso: 35, subtareasPendientes: 2, subtareasVencidas: 0 },
      { taskId: 2006, projectId: 103, userId: 21, nombre: 'Sesión de onboarding', estado: 'aceptada', progreso: 20, subtareasPendientes: 1, subtareasVencidas: 1 }
    ]
  },
  raw: {
    projects: [],
    tasks: [],
    subtasks: []
  },
  alerts: [
    { id: 1, tipo: 'proyecto', titulo: 'Proyecto asignado: Orbit Sales', estado: 'haciendo', projectId: 101, userId: 12, diasRestantes: 3, vencido: false },
    { id: 2, tipo: 'tarea', titulo: 'Tarea asignada: Revisión de leads', estado: 'por_hacer', projectId: 101, userId: 17, diasRestantes: 1, vencido: false },
    { id: 3, tipo: 'subtarea', titulo: 'Subtarea próxima a vencer', estado: 'haciendo', projectId: 102, userId: 21, diasRestantes: 0, vencido: true },
    { id: 4, tipo: 'elemento', titulo: 'Elemento vencido: Reporte operativo', estado: 'terminada', projectId: 102, userId: 12, diasRestantes: -2, vencido: true }
  ],
  users: [
    { id: 12, nombre: 'Ana Rivera' },
    { id: 17, nombre: 'Luis Gómez' },
    { id: 21, nombre: 'María Torres' }
  ],
  projects: [
    { id: 101, nombre: 'Orbit Sales' },
    { id: 102, nombre: 'Control Operativo' },
    { id: 103, nombre: 'Capacitación' }
  ],
  updatedAt: new Date().toISOString()
};
