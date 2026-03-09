import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EstadoTarea, getEstadoLabel } from '../../interfaces/estado.type';

@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './status-badge.component.html',
  styleUrls: ['./status-badge.component.scss']
})
export class StatusBadgeComponent {
  @Input() status: EstadoTarea | null = null;
  @Input() size: 'sm' | 'md' = 'md';

  get label(): string {
    return getEstadoLabel(this.status);
  }

  get badgeClass(): string {
    const base = this.size === 'sm' ? 'status-badge sm' : 'status-badge';
    return `${base} ${this.status ?? 'none'}`;
  }
}
