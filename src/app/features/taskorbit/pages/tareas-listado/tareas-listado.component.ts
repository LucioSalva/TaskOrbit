import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { RouterLink, RouterLinkActive, ActivatedRoute } from '@angular/router';
import { catchError, of } from 'rxjs';
import { AuthService } from '../../../auth/services/auth.service';
import { ProyectosService } from '../../services/proyectos.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';
import { Proyecto } from '../../interfaces/proyecto.interface';
import { Tarea } from '../../interfaces/tarea.interface';
import { Subtarea } from '../../interfaces/subtarea.interface';
import { EstadoTarea, getAvailableTransitions, getEstadoLabel, isTransitionAllowed } from '../../interfaces/estado.type';
import { TaskCardComponent } from '../../components/task-card/task-card.component';
import { SubtaskCardComponent } from '../../components/subtask-card/subtask-card.component';
import { EstadoChangeTrackerService } from '../../services/estado-change-tracker.service';
import { TaskFormModalComponent, TaskFormPayload } from '../../components/task-form-modal/task-form-modal.component';

@Component({
  selector: 'app-tareas-listado',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TaskCardComponent, SubtaskCardComponent, TaskFormModalComponent],
  templateUrl: './tareas-listado.component.html',
  styleUrls: ['./tareas-listado.component.scss']
})
export class TareasListadoComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private proyectosService = inject(ProyectosService);
  private tareasService = inject(TareasService);
  private subtareasService = inject(SubtareasService);
  private authService = inject(AuthService);
  private changeTracker = inject(EstadoChangeTrackerService);
  project = signal<Proyecto | null>(null);
  projectId = signal<number | null>(null);
  tasks = signal<Tarea[]>([]);
  subtasksByTask = signal<Record<number, Subtarea[]>>({});
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  formError = signal<string | null>(null);
  userFilter = signal('');
  taskMessages = signal<Record<number, string>>({});
  subtaskMessages = signal<Record<string, string>>({});
  isModalOpen = signal(false);
  selectedTask = signal<Tarea | null>(null);
  isSubtaskModalOpen = signal(false);
  selectedParentTask = signal<Tarea | null>(null);

  isGod = computed(() => this.authService.userRole() === 'GOD');

  isUser = computed(() => this.authService.userRole() === 'USER');
  isAdmin = computed(() => this.authService.userRole() === 'ADMIN');
  isLimitedRole = computed(() => {
    const role = this.authService.userRole();
    return role === 'USER';
  });

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;

  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  filteredTasks = computed(() => {
    const filter = this.userFilter().trim();
    if (!filter) {
      return this.tasks();
    }
    return this.tasks().filter((task) => `${this.getTaskAssignedUserId(task) ?? ''}`.includes(filter));
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id || Number.isNaN(id)) {
      this.errorMessage.set('Proyecto no encontrado.');
      this.isLoading.set(false);
      return;
    }
    this.projectId.set(id);
    const userId = this.currentUserId();
    if (this.isLimitedRole() && userId !== null) {
      this.userFilter.set(String(userId));
    }
    this.loadProject(id);
    this.loadTasks(id);
  }

  logout(): void {
    this.authService.logout();
  }

  private loadProject(id: number): void {
    this.proyectosService.getProyectoById(id)
      .pipe(catchError(() => of(null)))
      .subscribe((data) => {
        this.project.set(data);
      });
  }

  private loadTasks(id: number): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.tareasService.getTareasByProyecto(id)
      .pipe(
        catchError(() => {
          this.errorMessage.set('No se pudieron cargar las tareas.');
          return of([]);
        })
      )
      .subscribe((data) => {
        this.tasks.set(data);
        this.isLoading.set(false);
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

  onUserFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.userFilter.set(value);
  }

  getTaskAvailableStatuses(task: Tarea): EstadoTarea[] {
    return getAvailableTransitions(task.estado);
  }

  getSubtaskAvailableStatuses(subtask: Subtarea): EstadoTarea[] {
    return getAvailableTransitions(subtask.estado);
  }

  canEditTask(task: Tarea): boolean {
    const userId = this.currentUserId();
    if (userId === null) {
      return false;
    }
    const role = this.userRole();
    if (role === 'GOD' || role === 'ADMIN') {
      return true;
    }
    if (role === 'USER') {
      return this.getTaskAssignedUserId(task) === userId;
    }
    return false;
  }

  canManageTask(task: Tarea): boolean {
    const userId = this.currentUserId();
    if (userId === null) {
      return false;
    }
    const role = this.userRole();
    if (role === 'GOD' || role === 'ADMIN') {
      return true;
    }
    return false;
  }

  canEditSubtask(task: Tarea): boolean {
    const userId = this.currentUserId();
    if (userId === null) {
      return false;
    }
    const role = this.userRole();
    if (role === 'GOD' || role === 'ADMIN') {
      return true;
    }
    if (role === 'USER') {
      return this.getTaskAssignedUserId(task) === userId;
    }
    return false;
  }

  canManageSubtask(): boolean {
    const userId = this.currentUserId();
    if (userId === null) {
      return false;
    }
    const role = this.userRole();
    if (role === 'GOD' || role === 'ADMIN') {
      return true;
    }
    return false;
  }

  private getTaskAssignedUserId(task: Tarea): number | null {
    return task.usuarioAsignadoId ?? this.project()?.usuarioAsignadoId ?? null;
  }

  openCreateTask(): void {
    if (!this.isAdmin() && !this.isGod()) {
      return;
    }
    this.formError.set(null);
    this.selectedTask.set(null);
    this.isModalOpen.set(true);
  }

  openCreateSubtask(task: Tarea): void {
    if (!this.canManageSubtask()) {
      return;
    }
    this.formError.set(null);
    this.selectedParentTask.set(task);
    this.isSubtaskModalOpen.set(true);
  }

  openEditTask(task: Tarea): void {
    if (!this.canManageTask(task)) {
      return;
    }
    this.formError.set(null);
    this.selectedTask.set(task);
    this.isModalOpen.set(true);
  }

  closeTaskModal(): void {
    this.isModalOpen.set(false);
  }

  closeSubtaskModal(): void {
    this.isSubtaskModalOpen.set(false);
  }

  onSaveTask(payload: TaskFormPayload): void {
    this.formError.set(null);
    if (payload.tipo !== 'tarea' || !payload.proyectoId) {
      this.formError.set('No se pudo crear la tarea.');
      return;
    }
    const target = this.selectedTask();
    const taskPayload = {
      proyectoId: payload.proyectoId,
      nombre: payload.nombre,
      descripcion: payload.descripcion ?? null,
      prioridad: payload.prioridad,
      estado: payload.estado,
      fechaInicio: payload.fechaInicio ?? null,
      fechaFin: payload.fechaFin ?? null,
      estimacionMinutos: payload.estimacionMinutos ?? null
    };
    if (target) {
      this.tareasService.updateTarea(target.id, taskPayload).subscribe({
        next: (updated) => {
          this.tasks.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
          this.isModalOpen.set(false);
        },
        error: (error) => {
          this.formError.set(this.getErrorMessage(error, 'No se pudo actualizar la tarea.'));
        }
      });
      return;
    }

    this.tareasService.createTarea(taskPayload).subscribe({
      next: (created) => {
        const userId = this.currentUserId();
        if (!this.isUser() || (userId !== null && created.usuarioAsignadoId === userId)) {
          this.tasks.update((items) => [created, ...items]);
        }
        this.isModalOpen.set(false);
      },
      error: (error) => {
        this.formError.set(this.getErrorMessage(error, 'No se pudo crear la tarea.'));
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
      error: (error) => {
        this.formError.set(this.getErrorMessage(error, 'No se pudo crear la subtarea.'));
      }
    });
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    const payload = (error as { error?: { message?: string; data?: unknown } })?.error;
    const message = payload?.message || (error as { message?: string })?.message;
    const data = payload?.data;
    if (Array.isArray(data) && data.length > 0) {
      const detail = data.filter(Boolean).join(', ');
      return message ? `${message}: ${detail}` : detail;
    }
    return message || fallback;
  }

  onDeleteTask(task: Tarea): void {
    if (!this.canManageTask(task)) {
      return;
    }
    this.formError.set(null);
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
            this.formError.set('No se pudo eliminar la tarea.');
          }
        });
      },
      error: () => {
        this.formError.set('No se pudo cargar el resumen de eliminación.');
      }
    });
  }

  onDeleteSubtask(task: Tarea, subtask: Subtarea): void {
    if (!this.canManageSubtask()) {
      return;
    }
    this.formError.set(null);
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
            this.formError.set('No se pudo eliminar la subtarea.');
          }
        });
      },
      error: () => {
        this.formError.set('No se pudo cargar el resumen de eliminación.');
      }
    });
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
