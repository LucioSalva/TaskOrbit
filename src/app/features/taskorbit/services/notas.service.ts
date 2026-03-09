import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { Nota, NotaScope, NotaTipo } from '../interfaces/nota.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class NotasService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/notas';

  getNotas(scope?: NotaScope, referenciaId?: number): Observable<Nota[]> {
    const params: string[] = [];
    if (scope) {
      params.push(`scope=${scope}`);
    }
    if (referenciaId) {
      params.push(`referenciaId=${referenciaId}`);
    }
    const query = params.length ? `?${params.join('&')}` : '';
    return this.http.get<ApiResponse<Nota[]>>(`${this.API_URL}${query}`)
      .pipe(map(response => response.data));
  }

  createNota(payload: {
    titulo: string;
    contenido: string;
    tipo: NotaTipo;
    actividadTipo?: NotaScope;
    actividadId?: number | null;
  }): Observable<Nota> {
    return this.http.post<ApiResponse<Nota>>(this.API_URL, payload)
      .pipe(map(response => response.data));
  }
}
