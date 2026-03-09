import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Subtarea } from '../interfaces/subtarea.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class SubtareasService {
  private http = inject(HttpClient);
  private readonly API_BASE = 'http://localhost:3000/api';
  private readonly SUBTASK_URL = `${this.API_BASE}/subtareas`;
  private readonly TASK_URL = `${this.API_BASE}/tareas`;

  getSubtareasByTarea(tareaId: number, diagnostics = false): Observable<Subtarea[]> {
    const query = diagnostics ? '?dashboard=1' : '';
    return this.http.get<ApiResponse<Subtarea[]>>(`${this.TASK_URL}/${tareaId}/subtareas${query}`)
      .pipe(map(response => response.data));
  }

  createSubtarea(payload: Partial<Subtarea> & { tareaId: number }): Observable<Subtarea> {
    return this.http.post<ApiResponse<Subtarea>>(`${this.TASK_URL}/${payload.tareaId}/subtareas`, payload)
      .pipe(map(response => response.data));
  }

  getDeletePreview(id: number): Observable<{
    subtask: Subtarea;
    notes: number;
  }> {
    return this.http.get<ApiResponse<{
      subtask: Subtarea;
      notes: number;
    }>>(`${this.SUBTASK_URL}/${id}/delete-preview`)
      .pipe(map(response => response.data));
  }

  deleteSubtarea(id: number, reason?: string | null): Observable<{ id: number }> {
    return this.http.request<ApiResponse<{ id: number }>>('delete', `${this.SUBTASK_URL}/${id}`, {
      body: reason ? { reason } : {}
    }).pipe(map(response => response.data));
  }
}
