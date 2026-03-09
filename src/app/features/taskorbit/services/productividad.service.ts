import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { ResumenProductividad } from '../interfaces/resumen-productividad.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class ProductividadService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/productividad';

  getResumen(): Observable<ResumenProductividad> {
    return this.http.get<ApiResponse<ResumenProductividad>>(this.API_URL)
      .pipe(map(response => response.data));
  }
}
