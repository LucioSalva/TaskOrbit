import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, tap } from 'rxjs';
import { Proyecto } from '../interfaces/proyecto.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ProyectosService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/proyectos';

  getProyectos(diagnostics = false): Observable<Proyecto[]> {
    const query = diagnostics ? '?dashboard=1' : '';
    console.info('ProyectosService:getProyectos', { diagnostics });
    return this.http.get<ApiResponse<Proyecto[]>>(`${this.API_URL}${query}`)
      .pipe(
        tap((response) => {
          console.info('ProyectosService:getProyectos:response', {
            ok: response.ok,
            count: response.data?.length ?? 0
          });
        }),
        map(response => response.data)
      );
  }

  getProyectoById(id: number): Observable<Proyecto> {
    console.info('ProyectosService:getProyectoById', { id });
    return this.http.get<ApiResponse<Proyecto>>(`${this.API_URL}/${id}`)
      .pipe(
        tap((response) => {
          console.info('ProyectosService:getProyectoById:response', { ok: response.ok, id });
        }),
        map(response => response.data)
      );
  }

  createProyecto(payload: Partial<Proyecto>): Observable<Proyecto> {
    return this.http.post<ApiResponse<Proyecto>>(this.API_URL, payload)
      .pipe(map(response => response.data));
  }

  updateProyecto(id: number, payload: Partial<Proyecto>): Observable<Proyecto> {
    return this.http.put<ApiResponse<Proyecto>>(`${this.API_URL}/${id}`, payload)
      .pipe(map(response => response.data));
  }

  getDeletePreview(id: number): Observable<{
    project: Proyecto;
    tasks: number;
    subtasks: number;
    notes: { proyecto: number; tarea: number; subtarea: number };
  }> {
    return this.http.get<ApiResponse<{
      project: Proyecto;
      tasks: number;
      subtasks: number;
      notes: { proyecto: number; tarea: number; subtarea: number };
    }>>(`${this.API_URL}/${id}/delete-preview`)
      .pipe(map(response => response.data));
  }

  deleteProyecto(id: number, reason?: string | null): Observable<{ id: number }> {
    return this.http.request<ApiResponse<{ id: number }>>('delete', `${this.API_URL}/${id}`, {
      body: reason ? { reason } : {}
    }).pipe(map(response => response.data));
  }
}
