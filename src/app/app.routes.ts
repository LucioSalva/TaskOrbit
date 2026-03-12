import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Redirección inicial adecuada
  {
    path: '',
    redirectTo: 'login',
    pathMatch: 'full'
  },
  
  // Ruta /login pública
  {
    path: 'login',
    loadComponent: () => import('./features/auth/pages/login/login.component').then(m => m.LoginComponent)
  },

  // Ruta /dashboard protegida
  {
    path: 'dashboard',
    loadComponent: () => import('./features/dashboard/pages/dashboard/dashboard.component').then(m => m.DashboardComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['USER', 'ADMIN', 'GOD']
    }
  },

  {
    path: 'proyectos',
    loadComponent: () => import('./features/taskorbit/pages/proyectos-listado/proyectos-listado.component').then(m => m.ProyectosListadoComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['USER', 'ADMIN', 'GOD']
    }
  },
  {
    path: 'proyectos/:id',
    loadComponent: () => import('./features/taskorbit/pages/proyecto-detalle/proyecto-detalle.component').then(m => m.ProyectoDetalleComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['USER', 'ADMIN', 'GOD']
    }
  },
  {
    path: 'proyectos/:id/tareas',
    loadComponent: () => import('./features/taskorbit/pages/tareas-listado/tareas-listado.component').then(m => m.TareasListadoComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['USER', 'ADMIN', 'GOD']
    }
  },
  {
    path: 'notas',
    loadComponent: () => import('./features/taskorbit/pages/notas/notas.component').then(m => m.NotasComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['USER', 'ADMIN', 'GOD']
    }
  },

  // Ruta /admin/usuarios protegida (Solo GOD)
  {
    path: 'admin/usuarios',
    loadComponent: () => import('./features/admin-usuarios/pages/administrar-usuarios/administrar-usuarios.component').then(m => m.AdministrarUsuariosComponent),
    canActivate: [authGuard, roleGuard],
    data: {
      roles: ['GOD'] // Solo GOD puede acceder
    }
  },

  // Ruta /access-denied
  {
    path: 'access-denied',
    loadComponent: () => import('./features/auth/pages/access-denied/access-denied').then(m => m.AccessDeniedComponent)
  },

  // Fallback para rutas no encontradas
  {
    path: '**',
    redirectTo: 'login'
  }
];
