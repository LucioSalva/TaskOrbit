import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Tarea } from '../interfaces/tarea.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class TareasService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/tareas';

  getTareasByProyecto(proyectoId: number, diagnostics = false): Observable<Tarea[]> {
    const query = diagnostics ? '&dashboard=1' : '';
    return this.http.get<ApiResponse<Tarea[]>>(`${this.API_URL}?proyectoId=${proyectoId}${query}`)
      .pipe(map(response => response.data));
  }

  getTareaById(id: number): Observable<Tarea> {
    return this.http.get<ApiResponse<Tarea>>(`${this.API_URL}/${id}`)
      .pipe(map(response => response.data));
  }

  createTarea(payload: Partial<Tarea>): Observable<Tarea> {
    return this.http.post<ApiResponse<Tarea>>(this.API_URL, payload)
      .pipe(map(response => response.data));
  }

  updateTarea(id: number, payload: Partial<Tarea>): Observable<Tarea> {
    return this.http.put<ApiResponse<Tarea>>(`${this.API_URL}/${id}`, payload)
      .pipe(map(response => response.data));
  }

  getDeletePreview(id: number): Observable<{
    task: Tarea;
    subtasks: number;
    notes: { tarea: number; subtarea: number };
  }> {
    return this.http.get<ApiResponse<{
      task: Tarea;
      subtasks: number;
      notes: { tarea: number; subtarea: number };
    }>>(`${this.API_URL}/${id}/delete-preview`)
      .pipe(map(response => response.data));
  }

  deleteTarea(id: number, reason?: string | null): Observable<{ id: number }> {
    return this.http.request<ApiResponse<{ id: number }>>('delete', `${this.API_URL}/${id}`, {
      body: reason ? { reason } : {}
    }).pipe(map(response => response.data));
  }
}
