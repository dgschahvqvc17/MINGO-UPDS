import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Permite únicamente la pantalla de cambio de clave mientras el perfil
 * tenga una clave temporal pendiente de actualización.
 */
export const cambiarClaveGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const profile = await authService.ensureProfile();

  if (!profile) {
    return router.createUrlTree(['/auth/login']);
  }

  if (!profile.requiereCambioClave) {
    return router.createUrlTree([authService.homeRoute()]);
  }

  return true;
};

/** Redirige la raíz al panel correspondiente al rol del usuario. */
export const homeGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const profile = await authService.ensureProfile();

  if (!profile) {
    return router.createUrlTree(['/auth/login']);
  }

  return router.createUrlTree([authService.homeRoute()]);
};
