import { TestBed } from '@angular/core/testing';
import { routes } from '../../app.routes';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { UsuarioSesion } from '../models/auth.models';
import { AuthService } from '../services/auth.service';
import { authGuard } from './auth.guard';
import { cambiarClaveGuard, homeGuard } from './cambiar-clave.guard';
import { roleGuard } from './role.guard';

const PERFIL_BASE: UsuarioSesion = {
  id: 'usuario-1',
  email: 'ana@universidad.edu',
  nombre: 'Ana',
  apellido: 'Perez',
  requiereCambioClave: false,
  role: 'estudiante',
  roles: ['estudiante'],
};

function setup(profile: UsuarioSesion | null) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          ensureProfile: vi.fn().mockResolvedValue(profile),
          homeRoute: vi.fn().mockReturnValue(
            profile?.requiereCambioClave
              ? '/cambiar-clave'
              : profile?.role === 'administrador'
                ? '/administracion'
                : '/dashboard',
          ),
        },
      },
    ],
  });

  return {
    router: TestBed.inject(Router),
    authService: TestBed.inject(AuthService),
  };
}

function routeConRoles(roles: string[]): ActivatedRouteSnapshot {
  return { data: { roles } } as unknown as ActivatedRouteSnapshot;
}

function estadoEn(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

describe('guards de roles', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('authGuard envia al login con returnUrl cuando no hay perfil', async () => {
    const { router } = setup(null);
    const createUrlTree = vi.spyOn(router, 'createUrlTree');

    const resultado = await TestBed.runInInjectionContext(() =>
      authGuard(routeConRoles([]), estadoEn('/tareas')),
    );

    expect(resultado).not.toBe(true);
    expect(createUrlTree).toHaveBeenCalledWith(['/auth/login'], {
      queryParams: { returnUrl: '/tareas' },
    });
  });

  it('authGuard bloquea la navegacion mientras la clave sea temporal', async () => {
    const { router } = setup({ ...PERFIL_BASE, requiereCambioClave: true });
    const createUrlTree = vi.spyOn(router, 'createUrlTree');

    await TestBed.runInInjectionContext(() => authGuard(routeConRoles([]), estadoEn('/tareas')));

    expect(createUrlTree).toHaveBeenCalledWith(['/cambiar-clave']);
  });

  it('authGuard permite el acceso con un perfil activo', async () => {
    setup(PERFIL_BASE);

    const resultado = await TestBed.runInInjectionContext(() =>
      authGuard(routeConRoles([]), estadoEn('/tareas')),
    );

    expect(resultado).toBe(true);
  });

  it('roleGuard rechaza a un estudiante en una ruta de gestion', async () => {
    const { router } = setup(PERFIL_BASE);
    const createUrlTree = vi.spyOn(router, 'createUrlTree');

    await TestBed.runInInjectionContext(() =>
      roleGuard(routeConRoles(['administrador', 'docente']), estadoEn('/tareas/nueva')),
    );

    expect(createUrlTree).toHaveBeenCalledWith(['/dashboard']);
  });

  it('roleGuard permite a un docente crear y editar tareas', async () => {
    setup({ ...PERFIL_BASE, role: 'docente', roles: ['docente'] });

    const resultado = await TestBed.runInInjectionContext(() =>
      roleGuard(routeConRoles(['administrador', 'docente']), estadoEn('/tareas/nueva')),
    );

    expect(resultado).toBe(true);
  });

  it('cambiarClaveGuard solo permite la pantalla de cambio de clave', async () => {
    const conClaveTemporal = { ...PERFIL_BASE, requiereCambioClave: true };
    const { router } = setup(conClaveTemporal);
    const createUrlTree = vi.spyOn(router, 'createUrlTree');

    const permitido = await TestBed.runInInjectionContext(() =>
      cambiarClaveGuard(routeConRoles([]), estadoEn('/cambiar-clave')),
    );

    expect(permitido).toBe(true);

    TestBed.resetTestingModule();
    const sinClaveTemporal = setup(PERFIL_BASE);
    const redireccion = vi.spyOn(sinClaveTemporal.router, 'createUrlTree');

    await TestBed.runInInjectionContext(() =>
      cambiarClaveGuard(routeConRoles([]), estadoEn('/cambiar-clave')),
    );

    expect(redireccion).toHaveBeenCalledWith(['/dashboard']);
  });

  it('reserva alta y edicion de materias para administradores', () => {
    const rutasHijas = routes.find((ruta) => ruta.path === '')?.children ?? [];
    const rutasMateria = rutasHijas.filter((ruta) =>
      ['materias/nueva', 'materias/:id/editar'].includes(ruta.path ?? ''),
    );

    expect(rutasMateria).toHaveLength(2);
    expect(
      rutasMateria.every(
        (ruta) => JSON.stringify(ruta.data?.['roles']) === JSON.stringify(['administrador']),
      ),
    ).toBe(true);
  });

  it('homeGuard dirige la raiz al panel segun el rol', async () => {
    const { router } = setup({ ...PERFIL_BASE, role: 'administrador', roles: ['administrador'] });
    const createUrlTree = vi.spyOn(router, 'createUrlTree');

    await TestBed.runInInjectionContext(() => homeGuard(routeConRoles([]), estadoEn('/')));

    expect(createUrlTree).toHaveBeenCalledWith(['/administracion']);
  });
});
