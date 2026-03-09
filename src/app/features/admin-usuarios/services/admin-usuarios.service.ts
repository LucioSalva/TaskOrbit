import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { User } from '../interfaces/user.interface';
import { CreateUser } from '../interfaces/create-user.interface';
import { UpdateUser } from '../interfaces/update-user.interface';

interface ApiResponse<T> {
  ok: boolean;
  message: string;
  data: T;
}

@Injectable({
  providedIn: 'root'
})
export class AdminUsuariosService {
  private http = inject(HttpClient);
  private readonly API_URL = 'http://localhost:3000/api/usuarios';

  /**
   * Obtiene la lista completa de usuarios
   * GET /api/usuarios
   */
  getUsuarios(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(this.API_URL)
      .pipe(map(response => response.data));
  }

  /**
   * Crea un nuevo usuario
   * POST /api/usuarios
   * @param payload Datos del usuario a crear
   */
  createUsuario(payload: CreateUser): Observable<User> {
    return this.http.post<ApiResponse<User>>(this.API_URL, payload)
      .pipe(map(response => response.data));
  }

  /**
   * Actualiza los datos de un usuario existente
   * PUT /api/usuarios/:id
   * @param id ID del usuario
   * @param payload Datos a actualizar
   */
  updateUsuario(id: number, payload: UpdateUser): Observable<User> {
    return this.http.put<ApiResponse<User>>(`${this.API_URL}/${id}`, payload)
      .pipe(map(response => response.data));
  }

  /**
   * Cambia el estado (activo/inactivo) de un usuario
   * PATCH /api/usuarios/:id/estado
   * @param id ID del usuario
   * @param activo Nuevo estado
   */
  toggleEstado(id: number, activo: boolean): Observable<User> {
    return this.http.patch<ApiResponse<User>>(`${this.API_URL}/${id}/estado`, { activo })
      .pipe(map(response => response.data));
  }

  /**
   * Elimina un usuario físicamente
   * DELETE /api/usuarios/:id
   * @param id ID del usuario
   */
  deleteUsuario(id: number): Observable<any> {
    return this.http.delete<ApiResponse<any>>(`${this.API_URL}/${id}`)
      .pipe(map(response => response.data));
  }
}
