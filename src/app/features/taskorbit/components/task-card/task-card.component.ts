import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Tarea } from '../../interfaces/tarea.interface';
import { EstadoTarea, getEstadoLabel } from '../../interfaces/estado.type';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { TimeRemainingComponent } from '../time-remaining/time-remaining.component';

@Component({
  selector: 'app-task-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent, TimeRemainingComponent],
  templateUrl: './task-card.component.html',
  styleUrls: ['./task-card.component.scss']
})
export class TaskCardComponent {
  @Input() tarea!: Tarea;
  @Input() showUser = false;
  @Input() canEdit = false;
  @Input() showEditAction = false;
  @Input() showDeleteAction = false;
  @Input() showCreateSubtaskAction = false;
  @Input() availableStatuses: EstadoTarea[] = [];
  @Input() actionMessage: string | null = null;
  @Output() statusChange = new EventEmitter<EstadoTarea>();
  @Output() edit = new EventEmitter<Tarea>();
  @Output() remove = new EventEmitter<Tarea>();
  @Output() createSubtask = new EventEmitter<Tarea>();

  onStatusChange(status: EstadoTarea): void {
    this.statusChange.emit(status);
  }

  onEdit(): void {
    this.edit.emit(this.tarea);
  }

  onDelete(): void {
    this.remove.emit(this.tarea);
  }

  onCreateSubtask(): void {
    this.createSubtask.emit(this.tarea);
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }

  getPriorityLabel(): string {
    const prioridad = this.tarea?.prioridad ?? 'media';
    switch (prioridad) {
      case 'baja':
        return 'Baja';
      case 'alta':
        return 'Alta';
      case 'critica':
        return 'Crítica';
      default:
        return 'Media';
    }
  }

  isOverdue(): boolean {
    return this.getRemainingMinutes() === 0;
  }

  isNearDue(): boolean {
    const remaining = this.getRemainingMinutes();
    return remaining !== null && remaining > 0 && remaining <= 60;
  }

  private getRemainingMinutes(): number | null {
    if (!this.tarea?.estimacionMinutos || !this.tarea?.createdAt) {
      return null;
    }
    const created = new Date(this.tarea.createdAt);
    if (Number.isNaN(created.getTime())) {
      return null;
    }
    const elapsedMs = Date.now() - created.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return Math.max(this.tarea.estimacionMinutos - elapsedMinutes, 0);
  }
}
