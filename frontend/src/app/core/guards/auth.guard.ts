import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

/**
 * Protege las rutas privadas. Si Supabase no esta configurado en desarrollo,
 * permite el acceso para facilitar el trabajo inicial de la interfaz.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isConfigured && !environment.production) {
    return true;
  }

  if (await authService.hasActiveSession()) {
    return true;
  }

  return router.createUrlTree(['/auth/login'], {
    queryParams: { returnUrl: state.url },
  });
};
