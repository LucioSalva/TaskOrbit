import { Injectable, inject, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, of, catchError } from 'rxjs';
import { SessionService, User } from '../../../core/services/session.service';
import { LoginRequest } from '../interfaces/login-request.interface';
import { LoginResponse } from '../interfaces/login-response.interface';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private sessionService = inject(SessionService);
  
  public currentUser = computed(() => this.sessionService.user());
  public userRole = computed(() => this.sessionService.user()?.rol ?? null);

  // Ajusta la URL base según tu entorno
  private readonly API_URL = 'http://localhost:3000/api/auth';

  /**
   * Login con POST /api/auth/login
   */
  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/login`, credentials).pipe(
      tap(response => {
        if (response.ok && response.data) {
          // Guardar token y user con SessionService
          // Se asume que response.data.user cumple la interfaz User
          // O se hace un casting si es necesario
          this.sessionService.login(response.data.token, response.data.user as unknown as User);
        }
      })
    );
  }

  /**
   * Logout limpiando sesión
   */
  logout(): void {
    this.sessionService.logout();
  }

  /**
   * Obtiene datos del usuario actual (GET /api/auth/me)
   */
  getMe(): Observable<any> {
    return this.http.get(`${this.API_URL}/me`);
  }

  /**
   * Restaura la sesión al iniciar la app
   * Si falla, limpia la sesión
   */
  restoreSession(): Observable<boolean> {
    if (!this.sessionService.token()) {
      return of(false);
    }

    // Intentar validar token obteniendo info del usuario
    return new Observable<boolean>(observer => {
      this.getMe().subscribe({
        next: (response: any) => {
            if (response.ok && response.data) {
                this.sessionService.login(this.sessionService.token()!, response.data as unknown as User);
                observer.next(true);
            } else {
                this.sessionService.logout();
                observer.next(false);
            }
            observer.complete();
        },
        error: () => {
          this.sessionService.logout();
          observer.next(false);
          observer.complete();
        }
      });
    });
  }
}
