import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Protege las rutas privadas. Exige una sesion de Supabase y un perfil activo
 * validado por el backend.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const profile = await authService.ensureProfile();

  if (!profile) {
    return router.createUrlTree(['/auth/login'], {
      queryParams: { returnUrl: state.url },
    });
  }

  if (profile.requiereCambioClave) {
    return router.createUrlTree(['/cambiar-clave']);
  }

  return true;
};
