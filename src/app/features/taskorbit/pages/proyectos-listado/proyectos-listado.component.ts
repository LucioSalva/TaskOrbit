import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../../auth/services/auth.service';
import { ProyectosService } from '../../services/proyectos.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';
import { Proyecto } from '../../interfaces/proyecto.interface';
import { Tarea } from '../../interfaces/tarea.interface';
import { Subtarea } from '../../interfaces/subtarea.interface';
import { EstadoTarea, getAvailableTransitions, getEstadoLabel, isTransitionAllowed } from '../../interfaces/estado.type';
import { ProjectCardComponent } from '../../components/project-card/project-card.component';
import { catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { EstadoChangeTrackerService } from '../../services/estado-change-tracker.service';
import { ProjectFormModalComponent } from '../../components/project-form-modal/project-form-modal.component';
import { User } from '../../../admin-usuarios/interfaces/user.interface';
import { AdminUsuariosService } from '../../../admin-usuarios/services/admin-usuarios.service';

@Component({
  selector: 'app-proyectos-listado',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ProjectCardComponent, ProjectFormModalComponent],
  templateUrl: './proyectos-listado.component.html',
  styleUrls: ['./proyectos-listado.component.scss']
})
export class ProyectosListadoComponent implements OnInit {
  private authService = inject(AuthService);
  private proyectosService = inject(ProyectosService);
  private tareasService = inject(TareasService);
  private subtareasService = inject(SubtareasService);
  private adminUsuariosService = inject(AdminUsuariosService);
  private changeTracker = inject(EstadoChangeTrackerService);
  private route = inject(ActivatedRoute);

  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;
  projects = signal<Proyecto[]>([]);
  users = signal<User[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  formError = signal<string | null>(null);
  userFilter = signal('');
  statusMessages = signal<Record<number, string>>({});
  isModalOpen = signal(false);
  selectedProject = signal<Proyecto | null>(null);
  projectProgress = signal<Partial<Record<number, number>>>({});

  isUser = computed(() => this.authService.userRole() === 'USER');
  isGod = computed(() => this.authService.userRole() === 'GOD');
  isAdmin = computed(() => this.authService.userRole() === 'ADMIN');
  isLimitedRole = computed(() => {
    const role = this.authService.userRole();
    return role === 'USER';
  });

  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);

  filteredProjects = computed(() => {
    const filter = this.userFilter().trim();
    const usersMap = new Map(this.users().map((user) => [user.id, user.username]));
    const projects = this.projects().map((project) => {
      const username = usersMap.get(project.usuarioAsignadoId);
      if (!username || project.usuarioAsignadoNombre === username) {
        return project;
      }
      return {
        ...project,
        usuarioAsignadoNombre: username
      };
    });
    if (!filter) {
      return projects;
    }
    return projects.filter((project) => `${project.usuarioAsignadoId}`.includes(filter));
  });

  ngOnInit(): void {
    const createParam = this.route.snapshot.queryParamMap.get('create');
    if (createParam === '1' && (this.isAdmin() || this.isGod())) {
      this.openCreateProject();
    }
    const userId = this.currentUserId();
    if (this.isUser() && userId !== null) {
      this.userFilter.set(String(userId));
    }
    this.loadUsers();
    this.loadProjects();
  }

  loadUsers(): void {
    const current = this.currentUser();
    const role = this.userRole();
    if (!current) {
      this.users.set([]);
      return;
    }
    if (role === 'USER') {
      this.users.set([
        {
          id: current.id,
          nombre_completo: current.nombre_completo,
          username: current.username,
          telefono: '',
          rol: current.rol,
          activo: true
        }
      ]);
      return;
    }
    this.adminUsuariosService.getUsuarios()
      .pipe(
        catchError(() => of([]))
      )
      .subscribe((data) => {
        const filtered = data.filter((user) => user.rol !== 'GOD');
        this.users.set(filtered);
      });
  }

  loadProjects(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    console.info('ProyectosListado:loadProjects', {
      userId: this.currentUserId(),
      role: this.userRole()
    });
    this.proyectosService.getProyectos()
      .pipe(
        catchError((error) => {
          console.info('ProyectosListado:loadProjects:error', {
            status: error?.status ?? null,
            message: error?.error?.message ?? null
          });
          this.errorMessage.set('No se pudieron cargar los proyectos.');
          return of([]);
        })
      )
      .subscribe((data) => {
        const userId = this.currentUserId();
        let filtered = data;
        if (this.isUser() && userId !== null) {
          filtered = data.filter((project) => project.usuarioAsignadoId === userId);
        } else if (this.isAdmin() && userId !== null) {
          filtered = data.filter((project) => project.createdBy === userId);
        }
        console.info('ProyectosListado:projectsLoaded', {
          received: data.length,
          filtered: filtered.length,
          role: this.userRole(),
          userId
        });
        this.projects.set(filtered);
        this.loadProjectProgress(filtered);
        this.isLoading.set(false);
      });
  }

  onUserFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.userFilter.set(value);
  }

  getAvailableStatuses(project: Proyecto): EstadoTarea[] {
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

  canManageProject(project: Proyecto): boolean {
    const role = this.userRole();
    if (role === 'GOD' || role === 'ADMIN') return true;
    return false;
  }

  canDeleteProject(project: Proyecto): boolean {
    const role = this.userRole();
    return role === 'GOD' || role === 'ADMIN'; // Solo ADMIN/GOD pueden eliminar
  }

  openCreateProject(): void {
    if (!this.isAdmin() && !this.isGod()) {
      return;
    }
    this.formError.set(null);
    this.selectedProject.set(null);
    this.isModalOpen.set(true);
  }

  openEditProject(project: Proyecto): void {
    if (!this.canManageProject(project)) {
      return;
    }
    this.formError.set(null);
    this.selectedProject.set(project);
    this.isModalOpen.set(true);
  }

  closeProjectModal(): void {
    this.isModalOpen.set(false);
  }

  onSaveProject(payload: {
    nombre: string;
    descripcion?: string | null;
    prioridad: Proyecto['prioridad'];
    estado: EstadoTarea;
    usuarioAsignadoId: number;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    estimacionMinutos?: number | null;
  }): void {
    this.formError.set(null);
    const target = this.selectedProject();
    if (target) {
      this.proyectosService.updateProyecto(target.id, payload).subscribe({
        next: (updated) => {
          this.projects.update((items) => items.map((item) => (item.id === updated.id ? updated : item)));
          this.isModalOpen.set(false);
        },
        error: (error) => {
          const apiMessage = error?.error?.message;
          const apiDetail = error?.error?.error;
          const detailText = Array.isArray(apiDetail) ? apiDetail.join(', ') : apiDetail;
          const combined = apiMessage ? (detailText ? `${apiMessage}: ${detailText}` : apiMessage) : 'No se pudo actualizar el proyecto.';
          this.formError.set(combined);
        }
      });
      return;
    }

    this.proyectosService.createProyecto(payload).subscribe({
      next: (created) => {
        const userId = this.currentUserId();
        if (!this.isUser() || (userId !== null && created.usuarioAsignadoId === userId)) {
          this.projects.update((items) => [created, ...items]);
        }
        this.projectProgress.update((state) => ({
          ...state,
          [created.id]: 0
        }));
        this.isModalOpen.set(false);
      },
      error: (error) => {
        const apiMessage = error?.error?.message;
        const apiDetail = error?.error?.error;
        const detailText = Array.isArray(apiDetail) ? apiDetail.join(', ') : apiDetail;
        const combined = apiMessage ? (detailText ? `${apiMessage}: ${detailText}` : apiMessage) : 'No se pudo crear el proyecto.';
        this.formError.set(combined);
      }
    });
  }

  onDeleteProject(project: Proyecto): void {
    if (!this.canDeleteProject(project)) {
      return;
    }
    this.formError.set(null);
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
            this.projects.update((items) => items.filter((item) => item.id !== project.id));
        this.projectProgress.update((state) => {
          const { [project.id]: removed, ...rest } = state;
          return rest;
        });
          },
          error: () => {
            this.formError.set('No se pudo eliminar el proyecto.');
          }
        });
      },
      error: () => {
        this.formError.set('No se pudo cargar el resumen de eliminación.');
      }
    });
  }

  onProjectStatusChange(project: Proyecto, next: EstadoTarea): void {
    if (!this.canEditProject(project) || !isTransitionAllowed(project.estado, next)) {
      this.setMessage(project.id, 'Acción no permitida.');
      return;
    }
    const previous = project.estado;
    this.projects.update((items) =>
      items.map((item) => (item.id === project.id ? { ...item, estado: next } : item))
    );
    this.changeTracker.trackChange({
      entityType: 'proyecto',
      entityId: project.id,
      previous,
      next,
      userId: this.currentUserId()
    });
    this.setMessage(project.id, `Estado actualizado a ${getEstadoLabel(next)}.`);
  }

  logout(): void {
    this.authService.logout();
  }

  private setMessage(projectId: number, message: string): void {
    this.statusMessages.update((state) => ({
      ...state,
      [projectId]: message
    }));
    window.setTimeout(() => {
      this.statusMessages.update((state) => {
        const { [projectId]: removed, ...rest } = state;
        return rest;
      });
    }, 2200);
  }

  private loadProjectProgress(projects: Proyecto[]): void {
    if (projects.length === 0) {
      this.projectProgress.set({});
      return;
    }
    const requests = projects.map((project) =>
      this.tareasService.getTareasByProyecto(project.id).pipe(
        catchError(() => of([])),
        switchMap((tasks) => {
          if (tasks.length === 0) {
            return of({ projectId: project.id, progress: 0 });
          }
          const subtaskRequests = tasks.map((task) =>
            this.subtareasService.getSubtareasByTarea(task.id).pipe(catchError(() => of([])))
          );
          return forkJoin(subtaskRequests).pipe(
            map((subtasksByTask) => {
              const progresses = tasks.map((task, index) =>
                this.getTaskProgress(task, subtasksByTask[index] ?? [])
              );
              const average = progresses.length
                ? Math.round(progresses.reduce((acc, value) => acc + value, 0) / progresses.length)
                : 0;
              return { projectId: project.id, progress: average };
            })
          );
        })
      )
    );
    forkJoin(requests).subscribe((results) => {
      const next: Record<number, number> = {};
      results.forEach((result) => {
        next[result.projectId] = result.progress;
      });
      this.projectProgress.set(next);
    });
  }

  private getTaskProgress(task: Tarea, subtasks: Subtarea[]): number {
    if (subtasks.length > 0) {
      const completed = subtasks.filter((subtask) => subtask.estado === 'terminada').length;
      return Math.round((completed / subtasks.length) * 100);
    }
    return task.estado === 'terminada' ? 100 : 0;
  }
}
