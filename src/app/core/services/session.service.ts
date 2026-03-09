import { Injectable, signal, computed, inject } from '@angular/core';
import { Router } from '@angular/router';

// Definición básica de Usuario (puede moverse a una interfaz compartida luego)
export interface User {
  id: number;
  username: string;
  nombre_completo: string;
  rol: 'GOD' | 'ADMIN' | 'USER';
  telefono?: string;
  activo?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class SessionService {
  private router = inject(Router);

  // Signals privados para manejar el estado
  private _user = signal<User | null>(null);
  private _token = signal<string | null>(null);

  // Signals públicos de lectura (Requirements: obtener token y usuario, saber si hay sesión activa)
  public user = computed(() => this._user());
  public token = computed(() => this._token());
  public isAuthenticated = computed(() => !!this._token());

  constructor() {
    this.loadSession();
  }

  /**
   * Carga la sesión desde localStorage al iniciar
   */
  private loadSession(): void {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        this._token.set(token);
        this._user.set(user);
        console.info('Session:restored', { userId: user?.id ?? null, role: user?.rol ?? null });
      } catch (e) {
        console.error('Error al restaurar sesión', e);
        this.logout();
      }
    }
  }

  /**
   * Guarda el token y usuario en el estado y localStorage
   * (Requirement: guardar token y usuario)
   */
  login(token: string, user: User): void {
    this._token.set(token);
    this._user.set(user);

    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    console.info('Session:login', { userId: user.id, role: user.rol });
  }

  /**
   * Limpia la sesión y redirige al login
   * (Requirement: limpiar sesión)
   */
  logout(): void {
    this._token.set(null);
    this._user.set(null);

    localStorage.removeItem('token');
    localStorage.removeItem('user');
    console.info('Session:logout');
    
    this.router.navigate(['/login']);
  }
}
