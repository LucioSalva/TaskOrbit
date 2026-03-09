import { Component, EventEmitter, Input, Output, OnChanges, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Proyecto, PrioridadProyecto } from '../../interfaces/proyecto.interface';
import { EstadoTarea, ESTADOS_TAREA, getEstadoLabel } from '../../interfaces/estado.type';
import { User } from '../../../admin-usuarios/interfaces/user.interface';
import { UserRole } from '../../../auth/interfaces/auth-user.interface';

@Component({
  selector: 'app-project-form-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './project-form-modal.component.html',
  styleUrls: ['project-form-modal.component.scss']
})
export class ProjectFormModalComponent implements OnChanges {
  private fb = inject(FormBuilder);

  @Input() isOpen = false;
  @Input() projectToEdit: Proyecto | null = null;
  @Input() users: User[] = [];
  @Input() userRole: UserRole | null = null;
  @Output() close = new EventEmitter<void>();
  @Output() save = new EventEmitter<{
    nombre: string;
    descripcion?: string | null;
    prioridad: PrioridadProyecto;
    estado: EstadoTarea;
    usuarioAsignadoId: number;
    fechaInicio?: string | null;
    fechaFin?: string | null;
    estimacionMinutos?: number | null;
  }>();

  estados = ESTADOS_TAREA;
  prioridades: { value: PrioridadProyecto; label: string }[] = [
    { value: 'baja', label: 'Baja' },
    { value: 'media', label: 'Media' },
    { value: 'alta', label: 'Alta' },
    { value: 'critica', label: 'Crítica' }
  ];

  isEditMode = signal(false);
  businessDays = signal<number | null>(null);
  private readonly minutesPerBusinessDay = 8 * 60;

  projectForm: FormGroup = this.fb.group(
    {
      nombre: ['', [Validators.required, Validators.minLength(3)]],
      descripcion: [''],
      prioridad: ['media', [Validators.required]],
      estado: ['por_hacer', [Validators.required]],
      usuarioAsignadoId: [null, [Validators.required]],
      fechaInicio: [''],
      fechaFin: ['']
    },
    { validators: this.dateRangeValidator }
  );

  constructor() {
    this.projectForm.valueChanges.subscribe(() => {
      this.updateBusinessDays();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      if (this.projectToEdit) {
        this.isEditMode.set(true);
        this.projectForm.reset({
          nombre: this.projectToEdit.nombre,
          descripcion: this.projectToEdit.descripcion ?? '',
          prioridad: this.projectToEdit.prioridad ?? 'media',
          estado: this.projectToEdit.estado ?? 'por_hacer',
          usuarioAsignadoId: this.projectToEdit.usuarioAsignadoId,
          fechaInicio: this.projectToEdit.fechaInicio ?? '',
          fechaFin: this.projectToEdit.fechaFin ?? ''
        });
      } else {
        this.isEditMode.set(false);
        this.projectForm.reset({
          nombre: '',
          descripcion: '',
          prioridad: 'media',
          estado: 'por_hacer',
          usuarioAsignadoId: null,
          fechaInicio: '',
          fechaFin: ''
        });
      }
      this.updateBusinessDays();
      this.applySingleUserAssignment();
    }
    if (this.isOpen && changes['users']) {
      this.applySingleUserAssignment();
    }
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }

  onClose(): void {
    this.projectForm.reset({
      nombre: '',
      descripcion: '',
      prioridad: 'media',
      estado: 'por_hacer',
      usuarioAsignadoId: null,
      fechaInicio: '',
      fechaFin: ''
    });
    this.businessDays.set(null);
    this.close.emit();
  }

  onSubmit(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();
      return;
    }
    const value = this.projectForm.value;
    const estimacionMinutos = this.getEstimatedMinutes();
    const estado = this.shouldShowEstado() ? value.estado : 'por_hacer';
    this.save.emit({
      nombre: value.nombre as string,
      descripcion: value.descripcion || null,
      prioridad: value.prioridad as PrioridadProyecto,
      estado: estado as EstadoTarea,
      usuarioAsignadoId: Number(value.usuarioAsignadoId),
      fechaInicio: value.fechaInicio || null,
      fechaFin: value.fechaFin || null,
      estimacionMinutos
    });
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
    const start = this.projectForm.get('fechaInicio')?.value;
    const end = this.projectForm.get('fechaFin')?.value;
    const rangeError = this.projectForm.errors?.['invalidRange'];
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

  private applySingleUserAssignment(): void {
    if (this.users.length !== 1) {
      return;
    }
    const userId = this.users[0]?.id ?? null;
    if (userId === null) {
      return;
    }
    const current = this.projectForm.get('usuarioAsignadoId')?.value ?? null;
    if (current === null) {
      this.projectForm.patchValue({ usuarioAsignadoId: userId }, { emitEvent: false });
    }
  }

  shouldShowEstado(): boolean {
    return this.isEditMode() || this.userRole !== 'ADMIN';
  }
}
