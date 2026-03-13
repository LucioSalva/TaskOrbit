import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { Proyecto } from '../../interfaces/proyecto.interface';
import { Tarea } from '../../interfaces/tarea.interface';
import { Subtarea } from '../../interfaces/subtarea.interface';
import { Nota } from '../../interfaces/nota.interface';
import { EstadoTarea, getAvailableTransitions, getEstadoLabel, isTransitionAllowed } from '../../interfaces/estado.type';
import { ProyectosService } from '../../services/proyectos.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';
import { NotasService } from '../../services/notas.service';
import { EstadoChangeTrackerService } from '../../services/estado-change-tracker.service';
import { StatusBadgeComponent } from '../../components/status-badge/status-badge.component';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { SubtaskCardComponent } from '../../components/subtask-card/subtask-card.component';
import { TimeRemainingComponent } from '../../components/time-remaining/time-remaining.component';
import { AuthService } from '../../../auth/services/auth.service';
import { TaskFormModalComponent, TaskFormPayload } from '../../components/task-form-modal/task-form-modal.component';

@Component({
  selector: 'app-proyecto-detalle',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    StatusBadgeComponent,
    TaskCardComponent,
    SubtaskCardComponent,
    TimeRemainingComponent,
    TaskFormModalComponent
  ],
  templateUrl: './proyecto-detalle.component.html',
  styleUrls: ['./proyecto-detalle.component.scss']
})
export class ProyectoDetalleComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private proyectosService = inject(ProyectosService);
  private tareasService = inject(TareasService);
  private subtareasService = inject(SubtareasService);
  private notasService = inject(NotasService);
  private authService = inject(AuthService);
  private changeTracker = inject(EstadoChangeTrackerService);

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;

  project = signal<Proyecto | null>(null);
  tasks = signal<Tarea[]>([]);
  subtasksByTask = signal<Record<number, Subtarea[]>>({});
  notes = signal<Nota[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  formError = signal<string | null>(null);
  projectMessage = signal<string | null>(null);
  taskMessages = signal<Record<number, string>>({});
  subtaskMessages = signal<Record<string, string>>({});
  isSubtaskModalOpen = signal(false);
  selectedParentTask = signal<Tarea | null>(null);

  isUser = computed(() => this.authService.userRole() === 'USER');
  isGod = computed(() => this.authService.userRole() === 'GOD');
  isAdmin = computed(() => this.authService.userRole() === 'ADMIN');
  isLimitedRole = computed(() => {
    const role = this.authService.userRole();
    return role === 'USER';
  });

  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  filteredTasks = computed(() => {
    const userId = this.currentUserId();
    if (this.isLimitedRole() && userId !== null) {
      return this.tasks().filter((task) => this.getTaskAssignedUserId(task) === userId);
    }
    return this.tasks();
  });

  filteredNotes = computed(() => {
    const userId = this.currentUserId();
    if (this.isLimitedRole() && userId !== null) {
      return this.notes().filter((note) => note.userId === userId);
    }
    return this.notes();
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.errorMessage.set('Proyecto no encontrado.');
      this.isLoading.set(false);
      return;
    }
    this.loadProject(id);
    this.loadTasks(id);
    this.loadNotes(id);
  }

  private loadProject(id: number): void {
    this.proyectosService.getProyectoById(id)
      .pipe(
        catchError(() => {
          this.errorMessage.set('No se pudo cargar el proyecto.');
          return of(null);
        })
      )
      .subscribe((data) => {
        this.project.set(data);
        this.isLoading.set(false);
      });
  }

  private loadTasks(id: number): void {
    this.tareasService.getTareasByProyecto(id)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        this.tasks.set(data);
        data.forEach((task) => {
          this.loadSubtasks(task.id);
        });
      });
  }

  private loadSubtasks(taskId: number): void {
    this.subtareasService.getSubtareasByTarea(taskId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        this.subtasksByTask.update((state) => ({
          ...state,
          [taskId]: data
        }));
      });
  }

  private loadNotes(proyectoId: number): void {
    this.notasService.getNotas('proyecto', proyectoId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        const userId = this.currentUserId();
        const filtered = this.isLimitedRole() && userId !== null
          ? data.filter((note) => note.userId === userId)
          : data;
        this.notes.set(filtered);
      });
  }

  getProjectAvailableStatuses(project: Proyecto): EstadoTarea[] {
    return getAvailableTransitions(project.estado);
  }

  canEditProject(project: Proyecto): boolean {
    const userId = this.currentUserId();
    if (userId === null) return false;
    const role = this.userRole();
    if (role === 'GOD') return true;
    // Solo el usuario asignado puede cambiar el estado del proyecto
    return project.usuarioAsignadoId === userId;
  }

  canDeleteProject(project: Proyecto): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // Solo ADMIN/GOD pueden eliminar
  }

  onProjectStatusChange(project: Proyecto, next: EstadoTarea): void {
    if (!this.canEditProject(project) || !isTransitionAllowed(project.estado, next)) {
      this.setProjectMessage('Acción no permitida.');
      return;
    }
    const previous = project.estado;
    this.project.update((current) => (current ? { ...current, estado: next } : current));
    this.changeTracker.trackChange({
      entityType: 'proyecto',
      entityId: project.id,
      previous,
      next,
      userId: this.currentUserId()
    });
    this.setProjectMessage(`Estado actualizado a ${getEstadoLabel(next)}.`);
  }

  onDeleteProject(project: Proyecto): void {
    if (!this.canDeleteProject(project)) {
      return;
    }
    this.proyectosService.getDeletePreview(project.id).subscribe({
      next: (preview) => {
        const message = [
          `Se eliminará el proyecto "${project.nombre}".`,
          `Tareas: ${preview.tasks}`,
          `Subtareas: ${preview.subtasks}`,
          `Notas de proyecto: ${preview.notes.proyecto}`,
          `Notas de tareas: ${preview.notes.tarea}`,
          `Notas de subtareas: ${preview.notes.subtarea}`,
          '',
          '¿Confirmas la eliminación?'
        ].join('\n');
        if (!confirm(message)) {
          return;
        }
        const reasonInput = prompt('Motivo de eliminación (opcional):');
        const reason = reasonInput && reasonInput.trim() ? reasonInput.trim() : null;
        this.proyectosService.deleteProyecto(project.id, reason).subscribe({
          next: () => {
            this.router.navigate(['/proyectos']);
          },
          error: () => {
            this.errorMessage.set('No se pudo eliminar el proyecto.');
          }
        });
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el resumen de eliminación.');
      }
    });
  }

  getTaskAvailableStatuses(task: Tarea): EstadoTarea[] {
    return getAvailableTransitions(task.estado);
  }

  getSubtaskAvailableStatuses(subtask: Subtarea): EstadoTarea[] {
    return getAvailableTransitions(subtask.estado);
  }

  canEditTask(task: Tarea): boolean {
    const userId = this.currentUserId();
    if (userId === null) return false;
    const role = this.userRole();
    if (role === 'GOD') return true;
    // Solo el usuario asignado puede cambiar el estado de la tarea
    const assignedId = this.getTaskAssignedUserId(task);
    return assignedId === userId;
  }

  canDeleteTask(task: Tarea): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // Solo ADMIN/GOD pueden eliminar
  }

  canEditSubtask(task: Tarea): boolean {
    const userId = this.currentUserId();
    if (userId === null) return false;
    const role = this.userRole();
    if (role === 'GOD') return true;
    // Solo el usuario asignado puede cambiar el estado de la subtarea
    const assignedId = this.getTaskAssignedUserId(task);
    return assignedId === userId;
  }

  canDeleteSubtask(task: Tarea): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // Solo ADMIN/GOD pueden eliminar
  }

  canManageTask(task?: Tarea): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // ADMIN/GOD pueden gestionar tareas
  }

  canManageSubtask(task?: Tarea): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // ADMIN/GOD pueden gestionar subtareas
  }

  private getTaskAssignedUserId(task: Tarea): number | null {
    return task.usuarioAsignadoId ?? this.project()?.usuarioAsignadoId ?? null;
  }

  openCreateSubtask(task: Tarea): void {
    if (!this.canManageSubtask()) {
      return;
    }
    this.formError.set(null);
    this.selectedParentTask.set(task);
    this.isSubtaskModalOpen.set(true);
  }

  closeSubtaskModal(): void {
    this.isSubtaskModalOpen.set(false);
  }

  onTaskStatusChange(task: Tarea, next: EstadoTarea): void {
    if (!this.canEditTask(task) || !isTransitionAllowed(task.estado, next)) {
      this.setTaskMessage(task.id, 'Acción no permitida.');
      return;
    }
    const previous = task.estado;
    this.tasks.update((items) => items.map((item) => (item.id === task.id ? { ...item, estado: next } : item)));
    this.tareasService.updateTarea(task.id, { estado: next }).subscribe({
      next: () => {
        this.changeTracker.trackChange({
          entityType: 'tarea',
          entityId: task.id,
          previous,
          next,
          userId: this.currentUserId()
        });
        this.setTaskMessage(task.id, `Estado actualizado a ${getEstadoLabel(next)}.`);
      },
      error: () => {
        this.tasks.update((items) => items.map((item) => (item.id === task.id ? { ...item, estado: previous } : item)));
        this.setTaskMessage(task.id, 'No se pudo actualizar el estado.');
      }
    });
  }

  onDeleteTask(task: Tarea): void {
    if (!this.canManageTask()) {
      return;
    }
    this.tareasService.getDeletePreview(task.id).subscribe({
      next: (preview) => {
        const message = [
          `Se eliminará la tarea "${task.nombre}".`,
          `Subtareas: ${preview.subtasks}`,
          `Notas de tarea: ${preview.notes.tarea}`,
          `Notas de subtareas: ${preview.notes.subtarea}`,
          '',
          '¿Confirmas la eliminación?'
        ].join('\n');
        if (!confirm(message)) {
          return;
        }
        const reasonInput = prompt('Motivo de eliminación (opcional):');
        const reason = reasonInput && reasonInput.trim() ? reasonInput.trim() : null;
        this.tareasService.deleteTarea(task.id, reason).subscribe({
          next: () => {
            this.tasks.update((items) => items.filter((item) => item.id !== task.id));
            this.subtasksByTask.update((state) => {
              const { [task.id]: removed, ...rest } = state;
              return rest;
            });
          },
          error: () => {
            this.errorMessage.set('No se pudo eliminar la tarea.');
          }
        });
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el resumen de eliminación.');
      }
    });
  }

  onSubtaskStatusChange(task: Tarea, subtask: Subtarea, next: EstadoTarea): void {
    if (!this.canEditSubtask(task) || !isTransitionAllowed(subtask.estado, next)) {
      this.setSubtaskMessage(task.id, subtask.id, 'Acción no permitida.');
      return;
    }
    const subtaskId = Number(subtask.id);
    if (!Number.isInteger(subtaskId) || subtaskId <= 0) {
      this.setSubtaskMessage(task.id, subtask.id, 'No se pudo actualizar: ID de subtarea inválido.');
      return;
    }
    const previous = subtask.estado;
    this.subtasksByTask.update((state) => ({
      ...state,
      [task.id]: (state[task.id] || []).map((item) => (item.id === subtaskId ? { ...item, estado: next } : item))
    }));
    this.subtareasService.updateSubtarea(subtaskId, { estado: next }).subscribe({
      next: () => {
        this.changeTracker.trackChange({
          entityType: 'subtarea',
          entityId: subtaskId,
          previous,
          next,
          userId: this.currentUserId()
        });
        this.setSubtaskMessage(task.id, subtaskId, `Estado actualizado a ${getEstadoLabel(next)}.`);
      },
      error: (error) => {
        if (error instanceof HttpErrorResponse) {
          console.error('Subtask update failed', {
            status: error.status,
            url: error.url,
            subtaskId,
            response: error.error
          });
        }
        this.subtasksByTask.update((state) => ({
          ...state,
          [task.id]: (state[task.id] || []).map((item) => (item.id === subtaskId ? { ...item, estado: previous } : item))
        }));
        this.setSubtaskMessage(task.id, subtaskId, this.resolveSubtaskUpdateMessage(error, subtaskId));
      }
    });
  }

  onDeleteSubtask(task: Tarea, subtask: Subtarea): void {
    if (!this.canManageSubtask()) {
      return;
    }
    this.subtareasService.getDeletePreview(subtask.id).subscribe({
      next: (preview) => {
        const message = [
          `Se eliminará la subtarea "${subtask.nombre}".`,
          `Notas de subtarea: ${preview.notes}`,
          '',
          '¿Confirmas la eliminación?'
        ].join('\n');
        if (!confirm(message)) {
          return;
        }
        const reasonInput = prompt('Motivo de eliminación (opcional):');
        const reason = reasonInput && reasonInput.trim() ? reasonInput.trim() : null;
        this.subtareasService.deleteSubtarea(subtask.id, reason).subscribe({
          next: () => {
            this.subtasksByTask.update((state) => ({
              ...state,
              [task.id]: (state[task.id] || []).filter((item) => item.id !== subtask.id)
            }));
          },
          error: () => {
            this.errorMessage.set('No se pudo eliminar la subtarea.');
          }
        });
      },
      error: () => {
        this.errorMessage.set('No se pudo cargar el resumen de eliminación.');
      }
    });
  }

  onSaveSubtask(payload: TaskFormPayload): void {
    this.formError.set(null);
    const parentTask = this.selectedParentTask();
    if (!parentTask || payload.tipo !== 'subtarea' || !payload.tareaId) {
      this.formError.set('No se pudo crear la subtarea.');
      return;
    }
    this.subtareasService.createSubtarea({
      tareaId: payload.tareaId,
      nombre: payload.nombre,
      descripcion: payload.descripcion,
      prioridad: payload.prioridad,
      estado: payload.estado,
      fechaInicio: payload.fechaInicio,
      fechaFin: payload.fechaFin,
      estimacionMinutos: payload.estimacionMinutos
    }).subscribe({
      next: (created) => {
        this.subtasksByTask.update((state) => ({
          ...state,
          [parentTask.id]: [created, ...(state[parentTask.id] || [])]
        }));
        this.isSubtaskModalOpen.set(false);
      },
      error: () => {
        this.formError.set('No se pudo crear la subtarea.');
      }
    });
  }

  logout(): void {
    this.authService.logout();
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }

  isProjectOverdue(project: Proyecto): boolean {
    return this.getProjectRemainingMinutes(project) === 0;
  }

  isProjectNearDue(project: Proyecto): boolean {
    const remaining = this.getProjectRemainingMinutes(project);
    return remaining !== null && remaining > 0 && remaining <= 60;
  }

  private getProjectRemainingMinutes(project: Proyecto): number | null {
    if (!project.estimacionMinutos || !project.createdAt) {
      return null;
    }
    const created = new Date(project.createdAt);
    if (Number.isNaN(created.getTime())) {
      return null;
    }
    const elapsedMs = Date.now() - created.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return Math.max(project.estimacionMinutos - elapsedMinutes, 0);
  }

  private setProjectMessage(message: string): void {
    this.projectMessage.set(message);
    window.setTimeout(() => {
      this.projectMessage.set(null);
    }, 2200);
  }

  private setTaskMessage(taskId: number, message: string): void {
    this.taskMessages.update((state) => ({
      ...state,
      [taskId]: message
    }));
    window.setTimeout(() => {
      this.taskMessages.update((state) => {
        const { [taskId]: removed, ...rest } = state;
        return rest;
      });
    }, 2200);
  }

  private setSubtaskMessage(taskId: number, subtaskId: number, message: string): void {
    const key = `${taskId}-${subtaskId}`;
    this.subtaskMessages.update((state) => ({
      ...state,
      [key]: message
    }));
    window.setTimeout(() => {
      this.subtaskMessages.update((state) => {
        const { [key]: removed, ...rest } = state;
        return rest;
      });
    }, 2200);
  }

  private resolveSubtaskUpdateMessage(error: unknown, subtaskId: number): string {
    if (error instanceof HttpErrorResponse) {
      const backendMessage = typeof error.error?.message === 'string' ? error.error.message : null;
      if (error.status === 404) {
        return backendMessage ?? `Subtarea ${subtaskId} no encontrada para actualizar.`;
      }
      if (error.status === 403) {
        return backendMessage ?? 'No tienes permiso para actualizar esta subtarea.';
      }
      if (error.status === 401) {
        return 'Tu sesión expiró. Inicia sesión de nuevo.';
      }
      if (backendMessage) {
        return backendMessage;
      }
    }
    return 'No se pudo actualizar el estado.';
  }
}
