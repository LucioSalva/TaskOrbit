import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Tarea, PrioridadTarea } from '../../interfaces/tarea.interface';
import { EstadoTarea, ESTADOS_TAREA, getEstadoLabel } from '../../interfaces/estado.type';

type TaskFormMode = 'tarea' | 'subtarea';

export interface TaskFormPayload {
  tipo: TaskFormMode;
  proyectoId?: number;
  tareaId?: number;
  nombre: string;
  descripcion?: string | null;
  prioridad: PrioridadTarea;
  estado: EstadoTarea;
  fechaInicio?: string | null;
  fechaFin?: string | null;
  estimacionMinutos?: number | null;
}

@Component({
  selector: 'app-task-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './task-form-modal.component.html',
  styleUrls: ['./task-form-modal.component.scss']
})
export class TaskFormModalComponent implements OnChanges {
  private fb = inject(FormBuilder);

  @Input() isOpen = false;
  @Input() taskToEdit: Tarea | null = null;
  @Input() projectId: number | null = null;
  @Input() taskId: number | null = null;
  @Input() mode: TaskFormMode = 'tarea';
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<TaskFormPayload>();

  estados = ESTADOS_TAREA;
  prioridades: { value: PrioridadTarea; label: string }[] = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' }
  ];

  isEditMode = signal(false);
  businessDays = signal<number | null>(null);
  private readonly minutesPerBusinessDay = 8 * 60;
  headerLabel = signal('Nueva tarea');
  submitLabel = signal('Crear tarea');

  taskForm: FormGroup = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      prioridad: ['media', [Validators.required]],
      estado: ['por_hacer', [Validators.required]],
      fechaInicio: [''],
      fechaFin: ['']
    },
    { validators: this.dateRangeValidator }
  );

  constructor() {
    this.taskForm.valueChanges.subscribe(() => {
      this.updateBusinessDays();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.taskToEdit) {
        this.isEditMode.set(true);
        this.taskForm.reset({
          nombre: this.taskToEdit.nombre,
          descripcion: this.taskToEdit.descripcion ?? '',
          prioridad: this.taskToEdit.prioridad ?? 'media',
          estado: this.taskToEdit.estado ?? 'por_hacer',
          fechaInicio: this.taskToEdit.fechaInicio ?? '',
          fechaFin: this.taskToEdit.fechaFin ?? ''
        });
      } else {
        this.isEditMode.set(false);
        this.taskForm.reset({
          nombre: '',
          descripcion: '',
          prioridad: 'media',
          estado: 'por_hacer',
          fechaInicio: '',
          fechaFin: ''
        });
      }
      this.headerLabel.set(this.getHeaderLabel());
      this.submitLabel.set(this.getSubmitLabel());
      this.updateBusinessDays();
    }
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }

  onClose(): void {
    this.taskForm.reset({
      nombre: '',
      descripcion: '',
      prioridad: 'media',
      estado: 'por_hacer',
      fechaInicio: '',
      fechaFin: ''
    });
    this.businessDays.set(null);
    this.close.emit();
  }

  onSubmit(): void {
    if (this.taskForm.invalid || !this.hasValidParent()) {
      this.taskForm.markAllAsTouched();
      return;
    }
    const value = this.taskForm.value;
    const estimacionMinutos = this.getEstimatedMinutes();
    this.save.emit({
      tipo: this.mode,
      proyectoId: this.mode === 'tarea' ? this.projectId ?? undefined : undefined,
      tareaId: this.mode === 'subtarea' ? this.taskId ?? undefined : undefined,
      nombre: value.nombre as string,
      descripcion: value.descripcion || null,
      prioridad: value.prioridad as PrioridadTarea,
      estado: value.estado as EstadoTarea,
      fechaInicio: value.fechaInicio || null,
      fechaFin: value.fechaFin || null,
      estimacionMinutos
    });
  }

  private hasValidParent(): boolean {
    if (this.mode === 'subtarea') {
      return !!this.taskId;
    }
    return !!this.projectId;
  }

  private getHeaderLabel(): string {
    if (this.isEditMode()) {
      return this.mode === 'subtarea' ? 'Editar subtarea' : 'Editar tarea';
    }
    return this.mode === 'subtarea' ? 'Nueva subtarea' : 'Nueva tarea';
  }

  private getSubmitLabel(): string {
    if (this.isEditMode()) {
      return 'Guardar cambios';
    }
    return this.mode === 'subtarea' ? 'Crear subtarea' : 'Crear tarea';
  }

  private dateRangeValidator(group: AbstractControl): ValidationErrors | null {
    const start = group.get('fechaInicio')?.value;
    const end = group.get('fechaFin')?.value;
    if (!start || !end) {
      return null;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return null;
    }
    return endDate <= startDate ? { invalidRange: true } : null;
  }

  private updateBusinessDays(): void {
    const start = this.taskForm.get('fechaInicio')?.value;
    const end = this.taskForm.get('fechaFin')?.value;
    const rangeError = this.taskForm.errors?.['invalidRange'];
    if (!start || !end || rangeError) {
      this.businessDays.set(null);
      return;
    }
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      this.businessDays.set(null);
      return;
    }
    if (endDate < startDate) {
      this.businessDays.set(null);
      return;
    }
    const count = this.countBusinessDays(startDate, endDate);
    this.businessDays.set(count);
  }

  private getEstimatedMinutes(): number | null {
    const days = this.businessDays();
    if (days === null || days <= 0) {
      return null;
    }
    return days * this.minutesPerBusinessDay;
  }

  private countBusinessDays(startDate: Date, endDate: Date): number {
    const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
    const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) {
        count += 1;
      }
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}
