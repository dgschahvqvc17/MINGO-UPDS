import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { RolUsuario } from '../core/models/dominio.models';
import { AuthService } from '../core/services/auth.service';
import { NotificacionService } from '../core/services/notificacion.service';
import { PreferenciasInterfazService } from '../core/services/preferencias-interfaz.service';
import { ShellComponent } from './shell';

const asistenteFlotanteVisible = signal(true);

function configurarShell(role: RolUsuario, fullName = 'Ana Perez'): void {
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
      {
        provide: NotificacionService,
        useValue: {
          noLeidas: signal(2).asReadonly(),
          contarNoLeidas: vi.fn().mockReturnValue(of(2)),
        },
      },
      {
        provide: PreferenciasInterfazService,
        useValue: {
          asistenteFlotanteVisible: asistenteFlotanteVisible.asReadonly(),
        },
      },
    ],
  });
}

function createShell(role: RolUsuario, fullName = 'Ana Perez'): ShellComponent {
  configurarShell(role, fullName);
  return TestBed.createComponent(ShellComponent).componentInstance;
}

function navigationPaths(shell: ShellComponent): string[] {
  return shell.navSections().flatMap((section) => section.items.map((item) => item.path));
}

describe('ShellComponent', () => {
  afterEach(() => {
    asistenteFlotanteVisible.set(true);
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

  it('identifica al docente y le muestra las materias', () => {
    const shell = createShell('docente');

    expect(shell.roleLabel()).toBe('Docente');
    expect(navigationPaths(shell)).toContain('/materias');
    expect(navigationPaths(shell)).not.toContain('/administracion');
  });

  it('muestra las tarjetas de memoria en el area de aprendizaje', () => {
    const shell = createShell('estudiante');

    expect(navigationPaths(shell)).toContain('/tarjetas-memoria');
  });

  it('ofrece acceso global a las notificaciones con su contador', () => {
    const shell = createShell('estudiante');

    expect(navigationPaths(shell)).toContain('/notificaciones');
    expect(shell.notificacionesNoLeidas()).toBe(2);
  });

  it('calcula las iniciales con las dos primeras palabras del nombre', () => {
    const shell = createShell('estudiante', 'Ana Maria Perez');

    expect(shell.initials()).toBe('AM');
  });

  it('usa iniciales por defecto cuando no hay perfil cargado', () => {
    const shell = createShell('estudiante', '');

    expect(shell.initials()).toBe('MI');
  });

  it('alterna la barra lateral entre contraida y expandida', () => {
    const shell = createShell('estudiante');

    expect(shell.collapsed()).toBe(false);
    shell.toggleCollapsed();
    expect(shell.collapsed()).toBe(true);
    shell.toggleCollapsed();
    expect(shell.collapsed()).toBe(false);
  });

  it('muestra el ayudante flotante cuando la preferencia esta activada', () => {
    configurarShell('estudiante');

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-ayudante-flotante')).not.toBeNull();
  });

  it('oculta el ayudante flotante cuando la preferencia esta desactivada', () => {
    asistenteFlotanteVisible.set(false);
    configurarShell('estudiante');

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('app-ayudante-flotante')).toBeNull();
  });
});
