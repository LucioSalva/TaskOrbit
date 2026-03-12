import { AfterViewInit, Component, ElementRef, OnInit, ViewChild, computed, effect, inject, signal } from '@angular/core';
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
export class DashboardComponent implements OnInit, AfterViewInit {
  private authService = inject(AuthService);
  private metricsService = inject(DashboardMetricsService);
  private notificationService = inject(NotificationService);
  @ViewChild('toastStack') private toastStack?: ElementRef<HTMLElement>;
  @ViewChild('notificationsCenter') private notificationsCenter?: ElementRef<HTMLElement>;

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;
  metrics = signal<DashboardMetrics | null>(null);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);

  statusFilter = signal<EstadoTarea | 'todos'>('todos');
  userFilter = signal<number | 'todos'>('todos');
  projectFilter = signal<number | 'todos'>('todos');

  // Filtros temporales para la búsqueda manual
  tempStatusFilter = signal<EstadoTarea | 'todos'>('todos');
  tempUserFilter = signal<number | 'todos'>('todos');
  tempProjectFilter = signal<number | 'todos'>('todos');

  isAdminOrGod = computed(() => {
    const role = this.userRole();
    return role === 'ADMIN' || role === 'GOD';
  });

  isGod = computed(() => this.userRole() === 'GOD');
  isUser = computed(() => this.userRole() === 'USER');

  availableUsers = computed(() => this.metrics()?.users ?? []);
  availableProjects = computed(() => this.metrics()?.projects ?? []);
  notifications = this.notificationService.notifications;
  hiddenAlertIds = this.notificationService.hiddenAlerts;
  unreadCount = this.notificationService.unreadCount;
  recentToasts = this.notificationService.recentToasts;
  hasPersistentToasts = computed(() => this.recentToasts().some((item) => item.persistent));

  filteredTasks = computed<DashboardProductivityTask[]>(() => {
    return this.metrics()?.productivity.byTask ?? [];
  });

  scopedProjects = computed(() => {
    return this.metrics()?.raw?.projects ?? [];
  });

  filteredProjects = computed(() => {
    return this.scopedProjects();
  });

  filteredAlerts = computed<DashboardAlert[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const hiddenIds = new Set(this.hiddenAlertIds());
    return this.filterObsoleteAlerts(metrics.alerts, metrics.raw).filter(
      (alert) => !hiddenIds.has(this.getDashboardAlertPreferenceId(alert))
    );
  });

  hiddenAlertEntries = computed(() => {
    const byId = new Map(this.notifications().map((notification) => [notification.id, notification]));
    return this.hiddenAlertIds().map((id) => {
      const notification = byId.get(id);
      return {
        id,
        title: notification?.title ?? id,
        severity: notification?.severity ?? 'info'
      };
    });
  });

  filteredProductivityByUser = computed<DashboardProductivityUser[]>(() => {
    const metrics = this.metrics();
    if (!metrics) {
      return [];
    }
    const tasks = this.filteredTasks();
    const UNASSIGNED_KEY = 0;
    const grouped = new Map<number, DashboardProductivityUser>();
    tasks.forEach((task) => {
      const uid = task.userId ?? UNASSIGNED_KEY;
      const nombre = task.username ?? (uid === UNASSIGNED_KEY ? 'Sin asignar' : `Usuario ${uid}`);
      const base = grouped.get(uid) ?? {
        userId: uid,
        nombre,
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
      grouped.set(uid, base);
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
    return metrics.summary;
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

  constructor() {
    effect(() => {
      if (this.hasPersistentToasts()) {
        window.setTimeout(() => this.focusFirstToastAction(), 0);
      }
    });
  }

  ngOnInit(): void {
    const current = this.currentUser();
    let initialFilters: any = {};

    if (current && this.isUser()) {
      this.userFilter.set(current.id);
      this.tempUserFilter.set(current.id);
      initialFilters.userId = current.id;
    }
    this.loadMetrics(initialFilters);
  }

  ngAfterViewInit(): void {
    if (this.hasPersistentToasts()) {
      this.focusFirstToastAction();
    }
  }

  loadMetrics(filters: any = {}): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.metricsService.getMetrics(filters).subscribe({
      next: (data) => {
        this.metrics.set(data);
        
        // Requirement 5: Show error message if list is empty
        if (data.raw?.projects.length === 0) {
          this.errorMessage.set('No se encontraron proyectos con los filtros seleccionados.');
        }

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
    this.tempStatusFilter.set(value);
  }

  onUserFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.tempUserFilter.set(value === 'todos' ? 'todos' : Number(value));
  }

  onProjectFilter(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.tempProjectFilter.set(value === 'todos' ? 'todos' : Number(value));
  }

  applyFilters(): void {
    const status = this.tempStatusFilter();
    const user = this.tempUserFilter();
    const project = this.tempProjectFilter();

    this.statusFilter.set(status);
    this.userFilter.set(user);
    this.projectFilter.set(project);

    this.loadMetrics({
      status,
      userId: user,
      projectId: project
    });
  }

  clearFilters(): void {
    this.statusFilter.set('todos');
    this.tempStatusFilter.set('todos');
    
    let userId: number | 'todos' = 'todos';
    if (this.isUser() && this.currentUser()) {
      userId = this.currentUser()!.id;
      this.userFilter.set(userId);
      this.tempUserFilter.set(userId);
    } else {
      this.userFilter.set('todos');
      this.tempUserFilter.set('todos');
    }
    
    this.projectFilter.set('todos');
    this.tempProjectFilter.set('todos');

    this.loadMetrics({
      status: 'todos',
      userId,
      projectId: 'todos'
    });
  }

  logout(): void {
    this.authService.logout();
  }

  closeToast(notification: NotificationItem): void {
    this.notificationService.remove(notification.id);
  }

  focusNotificationCenter(): void {
    this.notificationsCenter?.nativeElement.focus();
  }

  onToastStackKeydown(event: KeyboardEvent): void {
    if (!this.hasPersistentToasts()) {
      return;
    }
    const actionButtons = this.getToastActionButtons();
    if (actionButtons.length === 0) {
      return;
    }
    if (event.key === 'Escape') {
      const firstPersistent = this.recentToasts().find((item) => item.persistent);
      if (firstPersistent) {
        event.preventDefault();
        this.closeToast(firstPersistent);
      }
      return;
    }
    if (event.key !== 'Tab') {
      return;
    }
    const currentIndex = actionButtons.findIndex((button) => button === document.activeElement);
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? actionButtons.length - 1 : currentIndex - 1)
      : (currentIndex === actionButtons.length - 1 ? 0 : currentIndex + 1);
    event.preventDefault();
    actionButtons[nextIndex].focus();
  }

  markAllNotificationsRead(): void {
    this.notificationService.markAllRead();
  }

  clearNotifications(): void {
    this.notificationService.clear();
  }

  hideNotification(notification: NotificationItem): void {
    this.notificationService.addHiddenAlert(notification.id);
    this.notificationService.remove(notification.id);
  }

  hideOperationalAlert(alert: DashboardAlert): void {
    const preferenceId = this.getDashboardAlertPreferenceId(alert);
    this.notificationService.addHiddenAlert(preferenceId);
  }

  showHiddenAlert(alertId: string): void {
    this.notificationService.removeHiddenAlert(alertId);
  }

  clearHiddenAlerts(): void {
    this.notificationService.clearHiddenAlerts();
  }

  private filterObsoleteAlerts(alerts: DashboardAlert[], raw: DashboardMetrics['raw']): DashboardAlert[] {
    return alerts.filter((alert) => {
      if (alert.tipo === 'proyecto') {
        return !this.isExpiredByProjectId(raw, alert.projectId);
      }
      if (alert.tipo === 'tarea') {
        return !this.isExpiredTaskAlert(raw, alert.projectId);
      }
      if (alert.tipo === 'subtarea') {
        return !this.isExpiredSubtaskAlert(raw, alert.projectId);
      }
      return true;
    });
  }

  private seedNotifications(metrics: DashboardMetrics): void {
    if (metrics.source === 'mock' || metrics.alerts.length === 0) {
      return;
    }
    const existingIds = new Set(this.notifications().map((item) => item.id));
    const items = metrics.alerts.flatMap((alert) => this.mapAlertToNotifications(alert, metrics.source));
    const hiddenIds = new Set(this.hiddenAlertIds());
    const fresh = items.filter((item) => !existingIds.has(item.id) && !hiddenIds.has(item.id));
    this.notificationService.addMany(fresh);
  }

  private seedAssignmentNotifications(metrics: DashboardMetrics): void {
    const current = this.currentUser();
    if (!current) {
      return;
    }
    const userId = current.id;
    const existingIds = new Set(this.notifications().map((item) => item.id));
    const base: Pick<NotificationItem, 'createdAt' | 'read' | 'source' | 'channel'> = {
      createdAt: new Date().toISOString(),
      read: false,
      source: 'local',
      channel: 'in_app'
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
          severity: 'success',
          autoDismissMs: this.getAutoDismissBySeverity('success'),
          persistent: false,
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
        severity: 'success',
        autoDismissMs: this.getAutoDismissBySeverity('success'),
        persistent: false,
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
        severity: 'success',
        autoDismissMs: this.getAutoDismissBySeverity('success'),
        persistent: false,
          entity: { tipo: 'subtarea', id: subtask.id, nombre: subtask.nombre },
          ...base
        });
      });

    const hiddenIds = new Set(this.hiddenAlertIds());
    const fresh = items.filter((item) => !existingIds.has(item.id) && !hiddenIds.has(item.id));
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
      autoDismissMs: this.getAutoDismissBySeverity(assignmentSeverity),
      persistent: false,
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
          autoDismissMs: this.getAutoDismissBySeverity('danger'),
          persistent: true,
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
          autoDismissMs: this.getAutoDismissBySeverity('warning'),
          persistent: false,
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

  private getAutoDismissBySeverity(severity: NotificationSeverity): number | null {
    if (severity === 'danger') {
      return null;
    }
    if (severity === 'warning') {
      return 5000;
    }
    return 4000;
  }

  private getToastActionButtons(): HTMLButtonElement[] {
    if (!this.toastStack) {
      return [];
    }
    return Array.from(this.toastStack.nativeElement.querySelectorAll('button'));
  }

  private focusFirstToastAction(): void {
    const firstAction = this.getToastActionButtons()[0];
    firstAction?.focus();
  }

  private getDashboardAlertPreferenceId(alert: DashboardAlert): string {
    return `dashboard-alert-${alert.tipo}-${alert.id}`;
  }

  private isExpiredByProjectId(raw: DashboardMetrics['raw'], projectId?: number): boolean {
    if (!projectId) {
      return false;
    }
    const project = raw.projects.find((item) => item.id === projectId);
    return this.isPastDate(project?.fechaFin);
  }

  private isExpiredTaskAlert(raw: DashboardMetrics['raw'], referenceId?: number): boolean {
    if (!referenceId) {
      return false;
    }
    const taskById = raw.tasks.find((item) => item.id === referenceId);
    if (taskById) {
      return this.isPastDate(taskById.fechaFin) || this.isExpiredByProjectId(raw, taskById.proyectoId);
    }
    const byProject = raw.tasks.find((item) => item.proyectoId === referenceId);
    if (byProject) {
      return this.isPastDate(byProject.fechaFin) || this.isExpiredByProjectId(raw, byProject.proyectoId);
    }
    return this.isExpiredByProjectId(raw, referenceId);
  }

  private isExpiredSubtaskAlert(raw: DashboardMetrics['raw'], referenceId?: number): boolean {
    if (!referenceId) {
      return false;
    }
    const subtask = raw.subtasks.find((item) => item.id === referenceId || item.tareaId === referenceId);
    if (!subtask) {
      return this.isExpiredTaskAlert(raw, referenceId);
    }
    const parentTask = raw.tasks.find((item) => item.id === subtask.tareaId);
    return (
      this.isPastDate(subtask.fechaFin) ||
      this.isPastDate(parentTask?.fechaFin) ||
      this.isExpiredByProjectId(raw, parentTask?.proyectoId)
    );
  }

  private isPastDate(value?: string | null): boolean {
    if (!value) {
      return false;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    return date.getTime() < Date.now();
  }
}
