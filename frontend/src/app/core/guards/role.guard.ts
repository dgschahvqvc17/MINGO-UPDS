import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Restringe el acceso segun los roles declarados en route.data.roles.
 *
 * Uso:
 *   { path: 'administracion', canActivate: [roleGuard], data: { roles: ['administrador'] } }
 */
export const roleGuard: CanActivateFn = (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] as string[] | undefined) ?? [];

  if (allowedRoles.length === 0 || allowedRoles.includes(authService.role())) {
    return true;
  }

  return router.createUrlTree(['/dashboard']);
};
