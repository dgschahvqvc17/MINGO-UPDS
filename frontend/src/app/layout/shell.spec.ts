import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RolUsuario } from '../core/models/dominio.models';
import { AuthService } from '../core/services/auth.service';
import { ShellComponent } from './shell';

function createShell(role: RolUsuario, fullName = 'Ana Perez'): ShellComponent {
  TestBed.configureTestingModule({
    imports: [ShellComponent],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: {
          role: signal(role).asReadonly(),
          fullName: signal(fullName).asReadonly(),
          profile: signal(null).asReadonly(),
          user: signal(null).asReadonly(),
          signOut: vi.fn(),
        },
      },
    ],
  });

  return TestBed.createComponent(ShellComponent).componentInstance;
}

function navigationPaths(shell: ShellComponent): string[] {
  return shell.navSections().flatMap((section) => section.items.map((item) => item.path));
}

describe('ShellComponent', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('oculta la administracion a un estudiante', () => {
    const shell = createShell('estudiante');

    expect(navigationPaths(shell)).not.toContain('/administracion');
  });

  it('muestra la administracion a un administrador', () => {
    const shell = createShell('administrador');

    expect(navigationPaths(shell)).toContain('/administracion');
  });

  it('calcula las iniciales con las dos primeras palabras del nombre', () => {
    const shell = createShell('estudiante', 'Ana Maria Perez');

    expect(shell.initials()).toBe('AM');
  });

  it('usa iniciales por defecto cuando no hay perfil cargado', () => {
    const shell = createShell('estudiante', '');

    expect(shell.initials()).toBe('MI');
  });
});
