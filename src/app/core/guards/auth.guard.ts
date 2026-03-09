import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const authGuard: CanActivateFn = (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);

  // Validar sesión activa
  if (sessionService.isAuthenticated()) {
    console.info('AuthGuard:allowed', { url: state?.url });
    return true;
  }

  // Si no hay sesión, redirigir a /login
  console.info('AuthGuard:redirect', { url: state?.url });
  return router.createUrlTree(['/login']);
};
