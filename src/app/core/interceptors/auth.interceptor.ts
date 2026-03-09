import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { SessionService } from '../services/session.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const sessionService = inject(SessionService);
  const token = sessionService.token();

  // Requisito: ignorar /api/auth/login
  const isLoginRequest = req.url.includes('/auth/login');
  
  let request = req;

  // Requisito: agregar Authorization Bearer automáticamente (si no es login)
  if (token && !isLoginRequest) {
    request = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        if (!isLoginRequest) {
          sessionService.logout();
        }
      }
      return throwError(() => error);
    })
  );
};
