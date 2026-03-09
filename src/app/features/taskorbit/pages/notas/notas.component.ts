import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../auth/services/auth.service';
import { NotasService } from '../../services/notas.service';
import { ProyectosService } from '../../services/proyectos.service';
import { TareasService } from '../../services/tareas.service';
import { SubtareasService } from '../../services/subtareas.service';
import { Nota, NotaScope, NotaTipo } from '../../interfaces/nota.interface';
import { Proyecto } from '../../interfaces/proyecto.interface';
import { Tarea } from '../../interfaces/tarea.interface';
import { Subtarea } from '../../interfaces/subtarea.interface';
import { catchError, of } from 'rxjs';

@Component({
  selector: 'app-notas',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, ReactiveFormsModule],
  templateUrl: './notas.component.html',
  styleUrls: ['./notas.component.scss']
})
export class NotasComponent implements OnInit {
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);
  private notasService = inject(NotasService);
  private proyectosService = inject(ProyectosService);
  private tareasService = inject(TareasService);
  private subtareasService = inject(SubtareasService);

  notes = signal<Nota[]>([]);
  projects = signal<Proyecto[]>([]);
  tasks = signal<Tarea[]>([]);
  subtasks = signal<Subtarea[]>([]);
  formTasks = signal<Tarea[]>([]);
  formSubtasks = signal<Subtarea[]>([]);
  isLoading = signal(true);
  errorMessage = signal<string | null>(null);
  formError = signal<string | null>(null);
  isSaving = signal(false);
  scopeFilter = signal<NotaScope | 'todas'>('todas');
  referenciaId = signal('');
  userFilter = signal('');
  selectedProjectId = signal<number | null>(null);
  selectedTaskId = signal<number | null>(null);
  selectedSubtaskId = signal<number | null>(null);
  isModalOpen = signal(false);
  noteType = signal<NotaTipo>('personal');
  activityType = signal<NotaScope>('proyecto');

  isAdminOrGod = computed(() => {
    const role = this.authService.userRole();
    return role === 'ADMIN' || role === 'GOD';
  });

  isUser = computed(() => this.authService.userRole() === 'USER');
  isGod = computed(() => this.authService.userRole() === 'GOD');
  isAdmin = computed(() => this.authService.userRole() === 'ADMIN');
  isLimitedRole = computed(() => {
    const role = this.authService.userRole();
    return role === 'USER';
  });

  currentUserId = computed(() => this.authService.currentUser()?.id ?? null);
  currentUser = this.authService.currentUser;
  userRole = this.authService.userRole;

  filteredNotes = computed(() => {
    const userFilter = this.userFilter().trim();
    if (!userFilter) {
      return this.notes();
    }
    return this.notes().filter((note) => `${note.userId}`.includes(userFilter));
  });

  projectMap = computed(() => new Map(this.projects().map((project) => [project.id, project.nombre])));
  taskMap = computed(() => new Map(this.tasks().map((task) => [task.id, task.nombre])));
  subtaskMap = computed(() => new Map(this.subtasks().map((subtask) => [subtask.id, subtask.nombre])));

  noteForm: FormGroup = this.fb.group({
    titulo: ['', [Validators.required, Validators.minLength(3)]],
    contenido: ['', [Validators.required, Validators.minLength(3)]],
    tipo: ['personal', [Validators.required]],
    actividadTipo: ['proyecto', [Validators.required]],
    proyectoId: [null],
    tareaId: [null],
    subtareaId: [null]
  });

  ngOnInit(): void {
    const userId = this.currentUserId();
    if (this.isUser() && userId !== null) {
      this.userFilter.set(String(userId));
    }
    this.loadProjects();
    this.loadNotes();
    if (this.selectedProjectId() !== null) {
      this.loadTasksByProject(this.selectedProjectId() as number);
    }
    if (this.selectedTaskId() !== null) {
      this.loadSubtasksByTask(this.selectedTaskId() as number);
    }
    this.noteForm.get('tipo')?.valueChanges.subscribe((value) => {
      this.noteType.set(value as NotaTipo);
      if (value !== 'actividad') {
        this.resetActivitySelection();
      }
      this.syncActivityValidators();
    });
    this.noteForm.get('actividadTipo')?.valueChanges.subscribe((value) => {
      this.activityType.set(value as NotaScope);
      this.resetActivitySelection();
      this.syncActivityValidators();
    });
    this.noteForm.get('proyectoId')?.valueChanges.subscribe((value) => {
      const projectId = value ? Number(value) : null;
      if (this.noteType() === 'actividad' && projectId) {
        this.loadFormTasksByProject(projectId);
      } else {
        this.formTasks.set([]);
        this.formSubtasks.set([]);
      }
      this.noteForm.patchValue({ tareaId: null, subtareaId: null }, { emitEvent: false });
      this.formSubtasks.set([]);
    });
    this.noteForm.get('tareaId')?.valueChanges.subscribe((value) => {
      const taskId = value ? Number(value) : null;
      if (this.noteType() === 'actividad' && taskId && this.activityType() === 'subtarea') {
        this.loadFormSubtasksByTask(taskId);
      } else {
        this.formSubtasks.set([]);
      }
      this.noteForm.patchValue({ subtareaId: null }, { emitEvent: false });
    });
    this.syncActivityValidators();
  }

  loadNotes(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const scopeValue = this.scopeFilter() === 'todas' ? undefined : this.scopeFilter();
    const referenciaValue = this.referenciaId().trim();
    const referenciaId = referenciaValue ? Number(referenciaValue) : undefined;
    this.notasService.getNotas(scopeValue as NotaScope | undefined, referenciaId)
      .pipe(
        catchError(() => {
          this.errorMessage.set('No se pudieron cargar las notas.');
          return of([]);
        })
      )
      .subscribe((data) => {
        const userId = this.currentUserId();
        const filtered = this.isLimitedRole() && userId !== null
          ? data.filter((note) => note.userId === userId)
          : data;
        this.notes.set(filtered);
        this.isLoading.set(false);
      });
  }

  private loadProjects(): void {
    this.proyectosService.getProyectos()
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        const userId = this.currentUserId();
        const filtered = this.isLimitedRole() && userId !== null
          ? data.filter((project) => project.usuarioAsignadoId === userId)
          : data;
        this.projects.set(filtered);
      });
  }

  private loadTasksByProject(projectId: number): void {
    this.tasks.set([]);
    this.subtasks.set([]);
    this.tareasService.getTareasByProyecto(projectId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        const userId = this.currentUserId();
        const filtered = this.isLimitedRole() && userId !== null
          ? data.filter((task) => task.usuarioAsignadoId === userId)
          : data;
        this.tasks.set(filtered);
      });
  }

  private loadSubtasksByTask(taskId: number): void {
    this.subtasks.set([]);
    this.subtareasService.getSubtareasByTarea(taskId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        this.subtasks.set(data);
      });
  }

  private loadFormTasksByProject(projectId: number): void {
    this.formTasks.set([]);
    this.formSubtasks.set([]);
    this.tareasService.getTareasByProyecto(projectId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        const userId = this.currentUserId();
        const filtered = this.isLimitedRole() && userId !== null
          ? data.filter((task) => task.usuarioAsignadoId === userId)
          : data;
        this.formTasks.set(filtered);
      });
  }

  private loadFormSubtasksByTask(taskId: number): void {
    this.formSubtasks.set([]);
    this.subtareasService.getSubtareasByTarea(taskId)
      .pipe(catchError(() => of([])))
      .subscribe((data) => {
        this.formSubtasks.set(data);
      });
  }

  onScopeChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as NotaScope | 'todas';
    this.scopeFilter.set(value);
    this.selectedProjectId.set(null);
    this.selectedTaskId.set(null);
    this.selectedSubtaskId.set(null);
    this.referenciaId.set('');
    this.tasks.set([]);
    this.subtasks.set([]);
    this.loadNotes();
  }

  onUserFilter(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.userFilter.set(value);
  }

  applyFilters(): void {
    this.loadNotes();
  }

  onProjectSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const projectId = value ? Number(value) : null;
    this.selectedProjectId.set(projectId);
    this.selectedTaskId.set(null);
    this.selectedSubtaskId.set(null);
    this.referenciaId.set(projectId ? String(projectId) : '');
    if (projectId) {
      this.loadTasksByProject(projectId);
    } else {
      this.tasks.set([]);
      this.subtasks.set([]);
    }
    if (this.scopeFilter() === 'proyecto') {
      this.loadNotes();
    }
  }

  onTaskSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const taskId = value ? Number(value) : null;
    this.selectedTaskId.set(taskId);
    this.selectedSubtaskId.set(null);
    this.referenciaId.set(taskId ? String(taskId) : '');
    if (taskId) {
      this.loadSubtasksByTask(taskId);
    } else {
      this.subtasks.set([]);
    }
    if (this.scopeFilter() === 'tarea') {
      this.loadNotes();
    }
  }

  onSubtaskSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    const subtaskId = value ? Number(value) : null;
    this.selectedSubtaskId.set(subtaskId);
    this.referenciaId.set(subtaskId ? String(subtaskId) : '');
    if (this.scopeFilter() === 'subtarea') {
      this.loadNotes();
    }
  }

  getReferenceLabel(note: Nota): string {
    if (note.scope === 'personal') {
      return 'Personal';
    }
    const referencia = note.actividadId ?? note.referenciaId;
    if (!referencia) {
      return `Sin referencia`;
    }
    if (note.scope === 'proyecto') {
      return this.projectMap().get(referencia) ?? `Proyecto #${referencia}`;
    }
    if (note.scope === 'tarea') {
      return this.taskMap().get(referencia) ?? `Tarea #${referencia}`;
    }
    return this.subtaskMap().get(referencia) ?? `Subtarea #${referencia}`;
  }

  openNoteModal(): void {
    this.formError.set(null);
    this.noteForm.reset({
      titulo: '',
      contenido: '',
      tipo: 'personal',
      actividadTipo: 'proyecto',
      proyectoId: null,
      tareaId: null,
      subtareaId: null
    });
    this.noteType.set('personal');
    this.activityType.set('proyecto');
    this.formTasks.set([]);
    this.formSubtasks.set([]);
    this.isModalOpen.set(true);
  }

  closeNoteModal(): void {
    this.isModalOpen.set(false);
  }

  submitNote(): void {
    if (this.noteForm.invalid) {
      this.noteForm.markAllAsTouched();
      return;
    }
    this.formError.set(null);
    this.isSaving.set(true);
    const titulo = String(this.noteForm.get('titulo')?.value || '').trim();
    const contenido = String(this.noteForm.get('contenido')?.value || '').trim();
    const tipo = this.noteForm.get('tipo')?.value as NotaTipo;
    let actividadTipo: NotaScope | undefined;
    let actividadId: number | null = null;
    if (tipo === 'actividad') {
      actividadTipo = this.noteForm.get('actividadTipo')?.value as NotaScope;
      if (actividadTipo === 'proyecto') {
        actividadId = this.noteForm.get('proyectoId')?.value ? Number(this.noteForm.get('proyectoId')?.value) : null;
      } else if (actividadTipo === 'tarea') {
        actividadId = this.noteForm.get('tareaId')?.value ? Number(this.noteForm.get('tareaId')?.value) : null;
      } else if (actividadTipo === 'subtarea') {
        actividadId = this.noteForm.get('subtareaId')?.value ? Number(this.noteForm.get('subtareaId')?.value) : null;
      }
    }
    this.notasService.createNota({
      titulo,
      contenido,
      tipo,
      actividadTipo,
      actividadId
    }).subscribe({
      next: (note) => {
        this.notes.update((items) => [note, ...items]);
        this.isSaving.set(false);
        this.isModalOpen.set(false);
      },
      error: () => {
        this.formError.set('No se pudo guardar la nota.');
        this.isSaving.set(false);
      }
    });
  }

  private resetActivitySelection(): void {
    this.noteForm.patchValue({ proyectoId: null, tareaId: null, subtareaId: null }, { emitEvent: false });
    this.formTasks.set([]);
    this.formSubtasks.set([]);
  }

  private syncActivityValidators(): void {
    const tipo = this.noteType();
    const actividadTipo = this.activityType();
    const proyecto = this.noteForm.get('proyectoId');
    const tarea = this.noteForm.get('tareaId');
    const subtarea = this.noteForm.get('subtareaId');
    proyecto?.clearValidators();
    tarea?.clearValidators();
    subtarea?.clearValidators();
    if (tipo === 'actividad') {
      if (actividadTipo === 'proyecto') {
        proyecto?.setValidators([Validators.required]);
      }
      if (actividadTipo === 'tarea') {
        proyecto?.setValidators([Validators.required]);
        tarea?.setValidators([Validators.required]);
      }
      if (actividadTipo === 'subtarea') {
        proyecto?.setValidators([Validators.required]);
        tarea?.setValidators([Validators.required]);
        subtarea?.setValidators([Validators.required]);
      }
    } else {
      this.noteForm.patchValue({ proyectoId: null, tareaId: null, subtareaId: null }, { emitEvent: false });
    }
    proyecto?.updateValueAndValidity({ emitEvent: false });
    tarea?.updateValueAndValidity({ emitEvent: false });
    subtarea?.updateValueAndValidity({ emitEvent: false });
  }

  logout(): void {
    this.authService.logout();
  }
}
