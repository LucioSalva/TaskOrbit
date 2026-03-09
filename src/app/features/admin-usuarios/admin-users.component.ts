import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth/services/auth.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="container p-5 text-center">
      <h1 class="text-white">Panel de Administración de Usuarios</h1>
      <p class="text-muted">Bienvenido, {{ authService.currentUser()?.nombre_completo }}</p>
      <button class="btn btn-danger mt-3" (click)="authService.logout()">Cerrar Sesión</button>
    </div>
  `
})
export class AdminUsersComponent {
  constructor(public authService: AuthService) {}
}
