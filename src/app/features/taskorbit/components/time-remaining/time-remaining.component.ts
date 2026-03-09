import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-time-remaining',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './time-remaining.component.html',
  styleUrls: ['./time-remaining.component.scss']
})
export class TimeRemainingComponent {
  @Input() createdAt: string | null = null;
  @Input() estimacionMinutos: number | null = null;

  get remainingMinutes(): number | null {
    if (!this.estimacionMinutos || !this.createdAt) {
      return null;
    }
    const created = new Date(this.createdAt);
    if (Number.isNaN(created.getTime())) {
      return null;
    }
    const elapsedMs = Date.now() - created.getTime();
    const elapsedMinutes = Math.floor(elapsedMs / 60000);
    return Math.max(this.estimacionMinutos - elapsedMinutes, 0);
  }

  get displayText(): string {
    if (this.remainingMinutes === null) {
      return 'Sin estimación';
    }
    if (this.remainingMinutes === 0) {
      return 'Tiempo agotado';
    }
    if (this.remainingMinutes < 60) {
      return `${this.remainingMinutes} min restantes`;
    }
    const hours = Math.floor(this.remainingMinutes / 60);
    const mins = this.remainingMinutes % 60;
    return `${hours}h ${mins}m restantes`;
  }

  get statusClass(): string {
    if (this.remainingMinutes === null) {
      return 'neutral';
    }
    if (this.remainingMinutes === 0) {
      return 'danger';
    }
    if (this.remainingMinutes <= 60) {
      return 'warning';
    }
    return 'ok';
  }
}
