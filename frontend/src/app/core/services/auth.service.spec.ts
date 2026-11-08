import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
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
  const api = { get: vi.fn().mockReturnValue(of(profile)) };

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
});
