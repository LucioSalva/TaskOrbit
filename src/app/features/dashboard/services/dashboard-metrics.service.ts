import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map, tap } from 'rxjs/operators';
import { DashboardMetrics } from '../interfaces/dashboard-metrics.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class DashboardMetricsService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/dashboard/metrics';

  getMetrics(filters?: { status?: string; userId?: number | string; projectId?: number | string; dateStart?: string; dateEnd?: string }): Observable<DashboardMetrics> {
    let params = new HttpParams();
    if (filters?.status && filters.status !== 'todos') params = params.set('status', filters.status);
    if (filters?.userId && filters.userId !== 'todos') params = params.set('userId', filters.userId.toString());
    if (filters?.projectId && filters.projectId !== 'todos') params = params.set('projectId', filters.projectId.toString());
    if (filters?.dateStart) params = params.set('dateStart', filters.dateStart);
    if (filters?.dateEnd) params = params.set('dateEnd', filters.dateEnd);

    console.info('DashboardMetricsService:getMetrics', { filters });

    return this.http.get<ApiResponse<DashboardMetrics>>(this.API_URL, { params }).pipe(
      tap((response) => {
        console.info('DashboardMetricsService:getMetrics:response', {
          ok: response.ok,
          summary: response.data?.summary
        });
      }),
      map((response) => response.data),
      catchError((error) => {
        console.error('DashboardMetricsService:getMetrics:error', error);
        return of(this.createEmptyMetrics());
      })
    );
  }

  private createEmptyMetrics(): DashboardMetrics {
    return {
      source: 'mock',
      summary: {
        proyectosActivos: 0,
        tareasPendientes: 0,
        subtareasVencidas: 0,
        tareasTerminadas: 0
      },
      productivity: {
        byUser: [],
        byProject: [],
        byTask: []
      },
      raw: {
        projects: [],
        tasks: [],
        subtasks: []
      },
      alerts: [],
      users: [],
      projects: [],
      updatedAt: new Date().toISOString()
    };
  }
}
