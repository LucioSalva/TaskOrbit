import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SessionService } from '../services/session.service';

export const roleGuard: CanActivateFn = (route, state) => {
  const sessionService = inject(SessionService);
  const router = inject(Router);
  const authenticated = sessionService.isAuthenticated();
  const user = sessionService.user();

  // 1. Validar sesión activa primero
  if (!authenticated) {
    console.info('RoleGuard:unauthenticated', { url: state?.url });
    return router.createUrlTree(['/login']);
  }

  // 2. Obtener roles permitidos desde data.roles
  const allowedRoles = route.data['roles'] as string[] | undefined;
  console.info('RoleGuard:check', {
    url: state?.url,
    role: user?.rol ?? null,
    allowedRoles: allowedRoles ?? []
  });

  // Si no hay roles definidos, bloqueamos por seguridad (o logueamos warning)
  if (!allowedRoles || allowedRoles.length === 0) {
    console.warn('RoleGuard: No roles defined in route data');
    return router.createUrlTree(['/login']);
  }

  // 3. Verificar si el usuario tiene rol permitido
  if (user && allowedRoles.includes(user.rol)) {
    console.info('RoleGuard:allowed', { url: state?.url, role: user.rol });
    return true;
  }

  // 4. Si no tiene permisos, redirigir a /access-denied
  console.info('RoleGuard:denied', { url: state?.url, role: user?.rol ?? null });
  return router.createUrlTree(['/access-denied']);
};
