import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { DashboardAlert, DashboardEntityRef, DashboardMetrics, DashboardProductivityTask } from '../interfaces/dashboard-metrics.interface';
import { AuthService } from '../../auth/services/auth.service';
import { AdminUsuariosService } from '../../admin-usuarios/services/admin-usuarios.service';
import { Proyecto } from '../../taskorbit/interfaces/proyecto.interface';
import { Subtarea } from '../../taskorbit/interfaces/subtarea.interface';
import { Tarea } from '../../taskorbit/interfaces/tarea.interface';
import { ProyectosService } from '../../taskorbit/services/proyectos.service';
import { SubtareasService } from '../../taskorbit/services/subtareas.service';
import { TareasService } from '../../taskorbit/services/tareas.service';

@Injectable({
  providedIn: 'root'
})
export class DashboardMetricsService {
  private authService = inject(AuthService);
  private proyectosService = inject(ProyectosService);
  private tareasService = inject(TareasService);
  private subtareasService = inject(SubtareasService);
  private adminUsuariosService = inject(AdminUsuariosService);

  getMetrics(): Observable<DashboardMetrics> {
    const enableDiagnostics = true;
    return this.proyectosService.getProyectos(true).pipe(
      switchMap((projects) => {
        const tasksByProject$ = projects.length
          ? forkJoin(projects.map((project) =>
            this.tareasService.getTareasByProyecto(project.id, true).pipe(catchError(() => of([])))
          ))
          : of([]);
        return forkJoin({
          projects: of(projects),
          tasksByProject: tasksByProject$,
          users: this.getUsersForMetrics()
        });
      }),
      switchMap(({ projects, tasksByProject, users }) => {
        const role = this.authService.userRole();
        const currentUserId = this.authService.currentUser()?.id ?? null;
        const filteredProjects = role === 'ADMIN' && currentUserId !== null
          ? projects.filter((project) =>
            project.createdBy === currentUserId || project.usuarioAsignadoId === currentUserId
          )
          : projects;
        const projectMap = new Map(filteredProjects.map((project) => [project.id, project]));
        let tasks = tasksByProject.flat().filter((task) => projectMap.has(task.proyectoId));
        if (role === 'USER' && currentUserId !== null) {
          tasks = tasks.filter((task) => {
            const fallbackUserId = projectMap.get(task.proyectoId)?.usuarioAsignadoId ?? null;
            return (task.usuarioAsignadoId ?? fallbackUserId) === currentUserId;
          });
        }
        const subtasksByTask$ = tasks.length
          ? forkJoin(tasks.map((task) =>
            this.subtareasService.getSubtareasByTarea(task.id, true).pipe(catchError(() => of([])))
          ))
          : of([]);
        return forkJoin({
          projects: of(filteredProjects),
          tasks: of(tasks),
          subtasksByTask: subtasksByTask$,
          users: of(users)
        });
      }),
      map(({ projects, tasks, subtasksByTask, users }) => {
        const subtasksMap = new Map<number, Subtarea[]>();
        subtasksByTask.forEach((subtasks, index) => {
          const task = tasks[index];
          if (task) {
            subtasksMap.set(task.id, subtasks);
          }
        });
        const metrics = this.buildMetrics(projects, tasks, subtasksMap, users);
        if (enableDiagnostics) {
          const totalSubtasks = subtasksByTask.reduce((acc, items) => acc + items.length, 0);
          console.info('dashboard:metrics', {
            projects: projects.length,
            tasks: tasks.length,
            subtasks: totalSubtasks,
            summary: metrics.summary
          });
        }
        return metrics;
      }),
      catchError(() => of(this.createEmptyMetrics()))
    );
  }

  private getUsersForMetrics(): Observable<DashboardEntityRef[]> {
    const role = this.authService.userRole();
    const current = this.authService.currentUser();
    if (role === 'ADMIN' || role === 'GOD') {
      return this.adminUsuariosService.getUsuarios().pipe(
        map((users) => users.map((user) => ({
          id: user.id,
          nombre: user.nombre_completo || user.username
        }))),
        catchError(() => of(current ? [{ id: current.id, nombre: current.nombre_completo }] : []))
      );
    }
    return of(current ? [{ id: current.id, nombre: current.nombre_completo }] : []);
  }

  private buildMetrics(
    projects: Proyecto[],
    tasks: Tarea[],
    subtasksMap: Map<number, Subtarea[]>,
    users: DashboardEntityRef[]
  ): DashboardMetrics {
    const projectMap = new Map(projects.map((project) => [project.id, project]));
    const projectRefs = projects.map((project) => ({ id: project.id, nombre: project.nombre }));
    const tasksMetrics: DashboardProductivityTask[] = tasks.map((task) => {
      const subtasks = subtasksMap.get(task.id) ?? [];
      const totalSubtasks = subtasks.length;
      const subtasksDone = subtasks.filter((subtask) => subtask.estado === 'terminada').length;
      const subtasksPending = Math.max(totalSubtasks - subtasksDone, 0);
      const taskOverdue = this.isOverdue(task.fechaFin);
      const subtasksVencidas = taskOverdue
        ? subtasks.filter((subtask) => subtask.estado !== 'terminada').length
        : 0;
      const progress = totalSubtasks > 0
        ? Math.round((subtasksDone / totalSubtasks) * 100)
        : task.estado === 'terminada'
          ? 100
          : 0;
      const fallbackUserId = projectMap.get(task.proyectoId)?.usuarioAsignadoId ?? 0;
      return {
        taskId: task.id,
        projectId: task.proyectoId,
        userId: task.usuarioAsignadoId ?? fallbackUserId,
        nombre: task.nombre,
        estado: task.estado,
        progreso: progress,
        subtareasPendientes: subtasksPending,
        subtareasVencidas
      };
    });

    const alerts = this.buildAlerts(projects, tasks, subtasksMap);
    const subtasks = tasks.flatMap((task) => subtasksMap.get(task.id) ?? []);
    const proyectosActivos = projects.filter((project) => project.estado !== 'terminada').length;
    const tareasPendientes = tasksMetrics.filter((task) => task.estado !== 'terminada').length;
    const tareasTerminadas = tasksMetrics.filter((task) => task.estado === 'terminada').length;
    const subtareasVencidas = tasksMetrics.reduce((acc, task) => acc + task.subtareasVencidas, 0);

    return {
      source: 'api',
      summary: {
        proyectosActivos,
        tareasPendientes,
        subtareasVencidas,
        tareasTerminadas
      },
      productivity: {
        byUser: [],
        byProject: [],
        byTask: tasksMetrics
      },
      raw: {
        projects,
        tasks,
        subtasks
      },
      alerts,
      users,
      projects: projectRefs,
      updatedAt: new Date().toISOString()
    };
  }

  private buildAlerts(
    projects: Proyecto[],
    tasks: Tarea[],
    subtasksMap: Map<number, Subtarea[]>
  ): DashboardAlert[] {
    const alerts: DashboardAlert[] = [];
    let index = 1;
    projects.forEach((project) => {
      if (this.isOverdue(project.fechaFin) && project.estado !== 'terminada') {
        alerts.push({
          id: index++,
          tipo: 'proyecto',
          titulo: `Proyecto vencido: ${project.nombre}`,
          estado: project.estado,
          projectId: project.id,
          userId: project.usuarioAsignadoId,
          diasRestantes: this.getDaysRemaining(project.fechaFin),
          vencido: true
        });
      }
    });
    tasks.forEach((task) => {
      const overdue = this.isOverdue(task.fechaFin);
      if (overdue && task.estado !== 'terminada') {
        alerts.push({
          id: index++,
          tipo: 'tarea',
          titulo: `Tarea vencida: ${task.nombre}`,
          estado: task.estado,
          projectId: task.proyectoId,
          userId: task.usuarioAsignadoId ?? undefined,
          diasRestantes: this.getDaysRemaining(task.fechaFin),
          vencido: true
        });
        const subtasks = subtasksMap.get(task.id) ?? [];
        subtasks
          .filter((subtask) => subtask.estado !== 'terminada')
          .forEach((subtask) => {
            alerts.push({
              id: index++,
              tipo: 'subtarea',
              titulo: `Subtarea vencida: ${subtask.nombre}`,
              estado: task.estado,
              projectId: task.proyectoId,
              userId: task.usuarioAsignadoId ?? undefined,
              diasRestantes: this.getDaysRemaining(task.fechaFin),
              vencido: true
            });
          });
      }
    });
    return alerts;
  }

  private isOverdue(dateValue?: string | null): boolean {
    if (!dateValue) {
      return false;
    }
    const date = new Date(dateValue);
    return Number.isNaN(date.getTime()) ? false : date.getTime() < Date.now();
  }

  private getDaysRemaining(dateValue?: string | null): number | undefined {
    if (!dateValue) {
      return undefined;
    }
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      return undefined;
    }
    const diffMs = date.getTime() - Date.now();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  private createEmptyMetrics(): DashboardMetrics {
    return {
      source: 'api',
      summary: {
        proyectosActivos: 0,
        tareasPendientes: 0,
        subtareasVencidas: 0,
        tareasTerminadas: 0
      },
      productivity: {
        byUser: [],
        byProject: [],
        byTask: []
      },
      alerts: [],
      raw: {
        projects: [],
        tasks: [],
        subtasks: []
      },
      users: [],
      projects: [],
      updatedAt: new Date().toISOString()
    };
  }
}
