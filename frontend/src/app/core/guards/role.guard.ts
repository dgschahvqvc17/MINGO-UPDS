import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import type { RolUsuario } from '../models/dominio.models';
import { AuthService } from '../services/auth.service';

/**
 * Restringe el acceso segun los roles declarados en route.data.roles.
 *
 * Uso:
 *   { path: 'administracion', canActivate: [roleGuard], data: { roles: ['administrador'] } }
 */
export const roleGuard: CanActivateFn = async (route) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const allowedRoles = (route.data['roles'] as RolUsuario[] | undefined) ?? [];

  const profile = await authService.ensureProfile();

  if (!profile) {
    return router.createUrlTree(['/auth/login']);
  }

  if (allowedRoles.length === 0 || allowedRoles.includes(profile.role)) {
    return true;
  }

  return router.createUrlTree([authService.homeRoute()]);
};
