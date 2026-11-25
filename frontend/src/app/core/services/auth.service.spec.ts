import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { UsuarioSesion } from '../models/auth.models';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { SupabaseService } from './supabase.service';

const ESTUDIANTE: UsuarioSesion = {
  id: 'estudiante-1',
  email: 'ana@universidad.edu',
  nombre: 'Ana',
  apellido: 'Perez',
  correo: 'ana@universidad.edu',
  estado: 'activo',
  requiereCambioClave: false,
  role: 'estudiante',
  roles: ['estudiante'],
};

const ADMINISTRADOR: UsuarioSesion = {
  ...ESTUDIANTE,
  id: 'admin-1',
  email: 'admin@mingo.test',
  role: 'administrador',
  roles: ['administrador'],
};

function setup(profile: UsuarioSesion = ESTUDIANTE) {
  const api = {
    get: vi.fn().mockReturnValue(of(profile)),
    post: vi.fn().mockReturnValue(of(undefined)),
  };

  TestBed.configureTestingModule({
    providers: [
      AuthService,
      { provide: SupabaseService, useValue: { isConfigured: false } },
      { provide: ApiService, useValue: api },
    ],
  });

  return { service: TestBed.inject(AuthService), api };
}

describe('AuthService', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('carga el perfil desde /auth/me y expone el rol', async () => {
    const { service, api } = setup(ADMINISTRADOR);

    const profile = await service.loadProfile();

    expect(api.get).toHaveBeenCalledWith('/auth/me');
    expect(profile.role).toBe('administrador');
    expect(service.role()).toBe('administrador');
  });

  it('dirige al panel administrativo cuando el rol es administrador', async () => {
    const { service } = setup(ADMINISTRADOR);

    await service.loadProfile();

    expect(service.homeRoute()).toBe('/administracion');
  });

  it('dirige al dashboard cuando el rol es estudiante', async () => {
    const { service } = setup(ESTUDIANTE);

    await service.loadProfile();

    expect(service.homeRoute()).toBe('/dashboard');
  });

  it('no valida el perfil si Supabase no esta configurado', async () => {
    const { service, api } = setup();

    await expect(service.ensureProfile()).resolves.toBeNull();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('resuelve la precedencia de roles aunque el backend solo envie roles', async () => {
    const perfilSinRolResuelto: UsuarioSesion = {
      ...ESTUDIANTE,
      role: 'estudiante',
      roles: ['estudiante', 'docente', 'administrador'],
    };
    const { service } = setup(perfilSinRolResuelto);

    const profile = await service.loadProfile();

    expect(profile.role).toBe('administrador');
    expect(service.isAdmin()).toBe(true);
  });

  it('prioriza el cambio de clave sobre el panel del rol', async () => {
    const conClaveTemporal: UsuarioSesion = {
      ...ADMINISTRADOR,
      requiereCambioClave: true,
    };
    const { service } = setup(conClaveTemporal);

    await service.loadProfile();

    expect(service.requiereCambioClave()).toBe(true);
    expect(service.homeRoute()).toBe('/cambiar-clave');
  });

  it('cambia la clave y libera el bloqueo de navegacion', async () => {
    const conClaveTemporal: UsuarioSesion = {
      ...ESTUDIANTE,
      requiereCambioClave: true,
    };
    const { service, api } = setup(conClaveTemporal);
    await service.loadProfile();

    await firstValueFrom(service.cambiarClave('temporal123', 'nuevaClave123'));

    expect(api.post).toHaveBeenCalledWith('/auth/cambiar-clave', {
      claveActual: 'temporal123',
      claveNueva: 'nuevaClave123',
    });
    expect(service.requiereCambioClave()).toBe(false);
    expect(service.homeRoute()).toBe('/dashboard');
  });
});
