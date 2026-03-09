import { EstadoTarea } from '../../taskorbit/interfaces/estado.type';
import { Proyecto } from '../../taskorbit/interfaces/proyecto.interface';
import { Subtarea } from '../../taskorbit/interfaces/subtarea.interface';
import { Tarea } from '../../taskorbit/interfaces/tarea.interface';

export type DashboardDataSource = 'mock' | 'api';
export type DashboardAlertType = 'proyecto' | 'tarea' | 'subtarea' | 'elemento';

export interface DashboardSummary {
  proyectosActivos: number;
  tareasPendientes: number;
  subtareasVencidas: number;
  tareasTerminadas: number;
}

export interface DashboardProductivityUser {
  userId: number;
  nombre: string;
  tareasPendientes: number;
  tareasTerminadas: number;
  subtareasVencidas: number;
}

export interface DashboardProductivityProject {
  projectId: number;
  nombre: string;
  tareasPendientes: number;
  tareasTerminadas: number;
  subtareasVencidas: number;
}

export interface DashboardProductivityTask {
  taskId: number;
  projectId: number;
  userId: number;
  nombre: string;
  estado: EstadoTarea;
  progreso: number;
  subtareasPendientes: number;
  subtareasVencidas: number;
}

export interface DashboardAlert {
  id: number;
  tipo: DashboardAlertType;
  titulo: string;
  estado: EstadoTarea;
  projectId?: number;
  userId?: number;
  diasRestantes?: number;
  vencido: boolean;
}

export interface DashboardEntityRef {
  id: number;
  nombre: string;
}

export interface DashboardMetrics {
  source: DashboardDataSource;
  summary: DashboardSummary;
  productivity: {
    byUser: DashboardProductivityUser[];
    byProject: DashboardProductivityProject[];
    byTask: DashboardProductivityTask[];
  };
  raw: {
    projects: Proyecto[];
    tasks: Tarea[];
    subtasks: Subtarea[];
  };
  alerts: DashboardAlert[];
  users: DashboardEntityRef[];
  projects: DashboardEntityRef[];
  updatedAt: string;
}
