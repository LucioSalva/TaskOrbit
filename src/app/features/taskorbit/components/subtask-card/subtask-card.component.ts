import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subtarea } from '../../interfaces/subtarea.interface';
import { EstadoTarea, getEstadoLabel } from '../../interfaces/estado.type';
import { StatusBadgeComponent } from '../status-badge/status-badge.component';

@Component({
  selector: 'app-subtask-card',
  standalone: true,
  imports: [CommonModule, StatusBadgeComponent],
  templateUrl: './subtask-card.component.html',
  styleUrls: ['./subtask-card.component.scss']
})
export class SubtaskCardComponent {
  @Input() subtarea!: Subtarea;
  @Input() canEdit = false;
  @Input() showDeleteAction = false;
  @Input() availableStatuses: EstadoTarea[] = [];
  @Input() actionMessage: string | null = null;
  @Output() statusChange = new EventEmitter<EstadoTarea>();
  @Output() remove = new EventEmitter<Subtarea>();

  onStatusChange(status: EstadoTarea): void {
    this.statusChange.emit(status);
  }

  onDelete(): void {
    this.remove.emit(this.subtarea);
  }

  getEstadoLabel(status: EstadoTarea): string {
    return getEstadoLabel(status);
  }
}
