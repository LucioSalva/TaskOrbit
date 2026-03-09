import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Proyecto } from '../../interfaces/proyecto.interface';
import { EstadoTarea, getEstadoLabel } from '../../interfaces/estado.type';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';
import { TimeRemainingComponent } from '../time-remaining/time-remaining.component';

@Component({
  selector: 'app-project-card',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent, TimeRemainingComponent],
  templateUrl: './project-card.component.html',
  styleUrls: ['./project-card.component.scss']
})
export class ProjectCardComponent {
  @Input() proyecto!: Proyecto;
  @Input() showUser = false;
  @Input() canEdit = false;
  @Input() showEditAction = false;
  @Input() showDeleteAction = false;
  @Input() progress = 0;
  @Input() availableStatuses: EstadoTarea[] = [];
  @Input() actionMessage: string | null = null;
  @Output() statusChange = new EventEmitter<EstadoTarea>();
  @Output() edit = new EventEmitter<Proyecto>();
  @Output() remove = new EventEmitter<Proyecto>();

  onStatusChange(status: EstadoTarea): void {
    this.statusChange.emit(status);
  }

  onEdit(): void {
    this.edit.emit(this.proyecto);
  }

  onDelete(): void {
    this.remove.emit(this.proyecto);
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }

  getPriorityLabel(): string {
    const prioridad = this.proyecto?.prioridad ?? 'media';
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
    if (!this.proyecto?.estimacionMinutos || !this.proyecto?.createdAt) {
      return null;
    }
    const created = new Date(this.proyecto.createdAt);
    if (Number.isNaN(created.getTime())) {
      return null;
    }
    const elapsedMs = Date.now() - created.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return Math.max(this.proyecto.estimacionMinutos - elapsedMinutes, 0);
  }
}
