import { Injectable } from '@angular/core';
import { EstadoTarea } from '../interfaces/estado.type';

export type EstadoChangeEntity = 'proyecto' | 'tarea' | 'subtarea';

export interface EstadoChangeRecord {
  id: string;
  entityType: EstadoChangeEntity;
  entityId: number;
  previous: EstadoTarea;
  next: EstadoTarea;
  userId: number | null;
  timestamp: string;
  source: 'local';
}

@Injectable({
  providedIn: 'root'
})
export class EstadoChangeTrackerService {
  private readonly storageKey = 'taskorbit.estadoChanges';

  getHistory(): EstadoChangeRecord[] {
    return this.readHistory();
  }

  trackChange(change: Omit<EstadoChangeRecord, 'id' | 'timestamp' | 'source'>): EstadoChangeRecord {
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const record: EstadoChangeRecord = {
      ...change,
      id,
      timestamp: new Date().toISOString(),
      source: 'local'
    };
    const history = this.readHistory();
    history.unshift(record);
    this.writeHistory(history);
    return record;
  }

  clearHistory(): void {
    localStorage.removeItem(this.storageKey);
  }

  private readHistory(): EstadoChangeRecord[] {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) {
      return [];
    }
    try {
      const data = JSON.parse(raw) as EstadoChangeRecord[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private writeHistory(history: EstadoChangeRecord[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(history.slice(0, 200)));
  }
}
