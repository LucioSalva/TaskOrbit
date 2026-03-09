import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { DashboardMetricsService } from '../../services/dashboard-metrics.service';
import { DashboardAlert, DashboardMetrics, DashboardProductivityProject, DashboardProductivityTask, DashboardProductivityUser } from '../../interfaces/dashboard-metrics.interface';
import { EstadoTarea } from '../../../taskorbit/interfaces/estado.type';
import { StatusBadgeComponent } from '../../../taskorbit/components/status-badge/status-badge.component';
import { NotificationItem, NotificationSeverity, NotificationType } from '../../../notifications/interfaces/notification.interface';
import { NotificationService } from '../../../notifications/services/notification.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, StatusBadgeComponent],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private metricsService = inject(DashboardMetricsService);
  private notificationService = inject(NotificationService);

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;
  metrics = signal<DashboardMetrics | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  statusFilter = signal<EstadoTarea | 'todos'>('todos');
  userFilter = signal<number | 'todos'>('todos');
  projectFilter = signal<number | 'todos'>('todos');

  isAdminOrGod = computed(() => {
    const role = this.userRole();
    return role === 'ADMIN' || role === 'GOD';
  });

  isGod = computed(() => this.userRole() === 'GOD');
  isUser = computed(() => this.userRole() === 'USER');

  availableUsers = computed(() => this.metrics()?.users ?? []);
  availableProjects = computed(() => this.metrics()?.projects ?? []);
  notifications = this.notificationService.notifications;
  unreadCount = this.notificationService.unreadCount;
  recentToasts = this.notificationService.recentToasts;

  filteredTasks = computed<DashboardProductivityTask[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const status = this.statusFilter();
    const user = this.userFilter();
    const project = this.projectFilter();

    return metrics.productivity.byTask.filter((task) => {
      const matchStatus = status === 'todos' || task.estado === status;
      const matchUser = user === 'todos' || task.userId === user;
      const matchProject = project === 'todos' || task.projectId === project;
      return matchStatus && matchUser && matchProject;
    });
  });

  scopedProjects = computed(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const user = this.userFilter();
    const projectId = this.projectFilter();
    return (metrics.raw?.projects ?? []).filter((project) => {
      const matchUser = user === 'todos' || project.usuarioAsignadoId === user;
      const matchProject = projectId === 'todos' || project.id === projectId;
      return matchUser && matchProject;
    });
  });

  filteredProjects = computed(() => {
    const status = this.statusFilter();
    return this.scopedProjects().filter((project) => {
      const matchStatus = status === 'todos' || project.estado === status;
      return matchStatus;
    });
  });

  filteredAlerts = computed<DashboardAlert[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const status = this.statusFilter();
    const user = this.userFilter();
    const project = this.projectFilter();

    return metrics.alerts.filter((alert) => {
      const matchStatus = status === 'todos' || alert.estado === status;
      const matchUser = user === 'todos' || alert.userId === user;
      const matchProject = project === 'todos' || alert.projectId === project;
      return matchStatus && matchUser && matchProject;
    });
  });

  filteredProductivityByUser = computed<DashboardProductivityUser[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const tasks = this.filteredTasks();
    const grouped = new Map<number, DashboardProductivityUser>();
    tasks.forEach((task) => {
      const base = grouped.get(task.userId) ?? {
        userId: task.userId,
        nombre: metrics.users.find((user) => user.id === task.userId)?.nombre ?? `Usuario ${task.userId}`,
        tareasPendientes: 0,
        tareasTerminadas: 0,
        subtareasVencidas: 0
      };
      if (task.estado === 'terminada') {
        base.tareasTerminadas += 1;
      } else {
        base.tareasPendientes += 1;
      }
      base.subtareasVencidas += task.subtareasVencidas;
      grouped.set(task.userId, base);
    });
    return Array.from(grouped.values());
  });

  filteredProductivityByProject = computed<DashboardProductivityProject[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const tasks = this.filteredTasks();
    const projects = this.filteredProjects();
    const projectNames = new Map((metrics.raw?.projects ?? []).map((project) => [project.id, project.nombre]));
    const grouped = new Map<number, DashboardProductivityProject>();
    projects.forEach((project) => {
      grouped.set(project.id, {
        projectId: project.id,
        nombre: project.nombre,
        tareasPendientes: 0,
        tareasTerminadas: 0,
        subtareasVencidas: 0
      });
    });
    tasks.forEach((task) => {
      const base = grouped.get(task.projectId) ?? {
        projectId: task.projectId,
        nombre: projectNames.get(task.projectId) ?? `Proyecto ${task.projectId}`,
        tareasPendientes: 0,
        tareasTerminadas: 0,
        subtareasVencidas: 0
      };
      if (task.estado === 'terminada') {
        base.tareasTerminadas += 1;
      } else {
        base.tareasPendientes += 1;
      }
      base.subtareasVencidas += task.subtareasVencidas;
      grouped.set(task.projectId, base);
    });
    return Array.from(grouped.values());
  });

  summary = computed(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return {
        proyectosActivos: 0,
        tareasPendientes: 0,
        subtareasVencidas: 0,
        tareasTerminadas: 0
      };
    }

    if (this.statusFilter() === 'todos' && this.userFilter() === 'todos' && this.projectFilter() === 'todos') {
      return metrics.summary;
    }

    const tasks = this.filteredTasks();
    const proyectosActivos = this.scopedProjects().filter((project) => project.estado !== 'terminada').length;
    const tareasPendientes = tasks.filter((task) => task.estado !== 'terminada').length;
    const tareasTerminadas = tasks.filter((task) => task.estado === 'terminada').length;
    const subtareasVencidas = this.filteredAlerts().filter((alert) => alert.tipo === 'subtarea' && alert.vencido).length;

    return {
      proyectosActivos,
      tareasPendientes,
      subtareasVencidas,
      tareasTerminadas
    };
  });

  barSeries = computed(() => {
    const projects = this.filteredProductivityByProject();
    const maxValue = Math.max(...projects.map((item) => item.tareasTerminadas), 1);
    return projects.map((item, index) => ({
      label: item.nombre,
      value: item.tareasTerminadas,
      percentage: Math.round((item.tareasTerminadas / maxValue) * 100),
      color: index % 2 === 0 ? '#3b82f6' : '#8b5cf6'
    }));
  });

  ngOnInit(): void {
    const current = this.currentUser();
    if (current && this.isUser()) {
      this.userFilter.set(current.id);
    }
    this.loadMetrics();
  }

  loadMetrics(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.metricsService.getMetrics().subscribe({
      next: (data) => {
        this.metrics.set(data);
        this.notificationService.removeBySource('mock');
        this.seedNotifications(data);
        this.seedAssignmentNotifications(data);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('No se pudieron cargar las métricas.');
        this.isLoading.set(false);
      }
    });
  }

  onStatusFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as EstadoTarea | 'todos';
    this.statusFilter.set(value);
  }

  onUserFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.userFilter.set(value === 'todos' ? 'todos' : Number(value));
  }

  onProjectFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.projectFilter.set(value === 'todos' ? 'todos' : Number(value));
  }

  clearFilters(): void {
    this.statusFilter.set('todos');
    if (this.isUser() && this.currentUser()) {
      this.userFilter.set(this.currentUser()!.id);
    } else {
      this.userFilter.set('todos');
    }
    this.projectFilter.set('todos');
  }

  logout(): void {
    this.authService.logout();
  }

  closeToast(notification: NotificationItem): void {
    this.notificationService.markRead(notification.id);
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  clearNotifications(): void {
    this.notificationService.clear();
  }

  private seedNotifications(metrics: DashboardMetrics): void {
    if (metrics.source === 'mock' || metrics.alerts.length === 0) {
      return;
    }
    const existingIds = new Set(this.notifications().map((item) => item.id));
    const items = metrics.alerts.flatMap((alert) => this.mapAlertToNotifications(alert, metrics.source));
    const fresh = items.filter((item) => !existingIds.has(item.id));
    this.notificationService.addMany(fresh);
  }

  private seedAssignmentNotifications(metrics: DashboardMetrics): void {
    const current = this.currentUser();
    if (!current) {
      return;
    }
    const userId = current.id;
    const existingIds = new Set(this.notifications().map((item) => item.id));
    const base: Pick<NotificationItem, 'createdAt' | 'read' | 'source' | 'channel' | 'severity'> = {
      createdAt: new Date().toISOString(),
      read: false,
      source: 'local',
      channel: 'in_app',
      severity: 'info'
    };
    const items: NotificationItem[] = [];
    const projects = metrics.raw?.projects ?? [];
    const tasks = metrics.raw?.tasks ?? [];
    const subtasks = metrics.raw?.subtasks ?? [];
    const projectMap = new Map(projects.map((project) => [project.id, project]));

    projects
      .filter((project) => project.usuarioAsignadoId === userId)
      .forEach((project) => {
        items.push({
          id: `assign-proyecto-${project.id}`,
          type: 'asignacion_proyecto',
          title: `Proyecto asignado: ${project.nombre}`,
          message: `Se te asignó el proyecto "${project.nombre}".`,
          entity: { tipo: 'proyecto', id: project.id, nombre: project.nombre },
          ...base
        });
      });

    const assignedTasks = tasks.filter((task) => {
      const fallbackUserId = task.usuarioAsignadoId ?? projectMap.get(task.proyectoId)?.usuarioAsignadoId ?? null;
      return fallbackUserId === userId;
    });
    assignedTasks.forEach((task) => {
      items.push({
        id: `assign-tarea-${task.id}`,
        type: 'asignacion_tarea',
        title: `Tarea asignada: ${task.nombre}`,
        message: `Se te asignó la tarea "${task.nombre}".`,
        entity: { tipo: 'tarea', id: task.id, nombre: task.nombre },
        ...base
      });
    });

    const assignedTaskIds = new Set(assignedTasks.map((task) => task.id));
    subtasks
      .filter((subtask) => assignedTaskIds.has(subtask.tareaId))
      .forEach((subtask) => {
        items.push({
          id: `assign-subtarea-${subtask.id}`,
          type: 'asignacion_subtarea',
          title: `Subtarea asignada: ${subtask.nombre}`,
          message: `Se te asignó la subtarea "${subtask.nombre}".`,
          entity: { tipo: 'subtarea', id: subtask.id, nombre: subtask.nombre },
          ...base
        });
      });

    const fresh = items.filter((item) => !existingIds.has(item.id));
    this.notificationService.addMany(fresh);
  }

  private mapAlertToNotifications(alert: DashboardAlert, source: 'mock' | 'api'): NotificationItem[] {
    const base = {
      createdAt: new Date().toISOString(),
      read: false,
      source,
      channel: 'in_app'
    } as const;

    const items: NotificationItem[] = [];
    const assignmentType = this.getAssignmentType(alert.tipo);
    const assignmentSeverity: NotificationSeverity = 'info';
    items.push({
      id: `alert-${alert.id}-${assignmentType}`,
      type: assignmentType,
      title: alert.titulo,
      message: `Nuevo ${alert.tipo} asignado.`,
      severity: assignmentSeverity,
      entity: this.getEntityRef(alert),
      ...base
    });

    if (alert.diasRestantes !== undefined) {
      if (alert.vencido || alert.diasRestantes <= 0) {
        items.push({
          id: `alert-${alert.id}-vencido`,
          type: 'vencido',
          title: alert.titulo,
          message: 'El tiempo ya venció.',
          severity: 'danger',
          entity: this.getEntityRef(alert),
          ...base
        });
      } else if (alert.diasRestantes <= 1) {
        items.push({
          id: `alert-${alert.id}-por-vencer`,
          type: 'por_vencer',
          title: alert.titulo,
          message: `Tiempo por vencer: ${alert.diasRestantes} días.`,
          severity: 'warning',
          entity: this.getEntityRef(alert),
          ...base
        });
      }
    }

    return items;
  }

  private getAssignmentType(tipo: DashboardAlert['tipo']): NotificationType {
    switch (tipo) {
      case 'proyecto':
        return 'asignacion_proyecto';
      case 'tarea':
        return 'asignacion_tarea';
      case 'subtarea':
        return 'asignacion_subtarea';
      default:
        return 'asignacion_tarea';
    }
  }

  private getEntityRef(alert: DashboardAlert): NotificationItem['entity'] {
    if (alert.tipo === 'proyecto' || alert.tipo === 'tarea' || alert.tipo === 'subtarea') {
      if (alert.projectId) {
        return { tipo: alert.tipo, id: alert.projectId };
      }
      if (alert.userId) {
        return { tipo: alert.tipo, id: alert.userId };
      }
    }
    return undefined;
  }
}
