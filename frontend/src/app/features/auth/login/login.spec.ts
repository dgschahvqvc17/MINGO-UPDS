import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { LoginPage } from './login';

interface PageOptions {
  homeRoute?: string;
  queryParams?: Record<string, string>;
}

function createPage(options: PageOptions = {}) {
  const signIn = vi.fn();
  const navigateByUrl = vi.fn().mockResolvedValue(true);
  const homeRoute = options.homeRoute ?? '/dashboard';

  TestBed.configureTestingModule({
    imports: [LoginPage],
    providers: [
      {
        provide: AuthService,
        useValue: {
          isConfigured: true,
          signIn,
          homeRoute: () => homeRoute,
          lastAuthError: () => null,
        },
      },
      { provide: Router, useValue: { navigateByUrl } },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: { queryParamMap: convertToParamMap(options.queryParams ?? {}) },
        },
      },
    ],
  });

  const fixture = TestBed.createComponent(LoginPage);
  fixture.detectChanges();

  return { page: fixture.componentInstance, signIn, navigateByUrl };
}

describe('LoginPage', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('no inicia sesion si el formulario es invalido', async () => {
    const { page, signIn } = createPage();

    page.form.setValue({ email: 'correo-invalido', password: '123' });
    await page.submit();

    expect(signIn).not.toHaveBeenCalled();
    expect(page.form.controls.email.touched).toBe(true);
  });

  it('inicia sesion y redirige al dashboard del estudiante', async () => {
    const { page, signIn, navigateByUrl } = createPage({ homeRoute: '/dashboard' });
    signIn.mockResolvedValue(undefined);

    page.form.setValue({ email: 'ana@universidad.edu', password: '12345678' });
    await page.submit();

    expect(signIn).toHaveBeenCalledWith('ana@universidad.edu', '12345678');
    expect(navigateByUrl).toHaveBeenCalledWith('/dashboard');
  });

  it('redirige al panel administrativo cuando el rol es administrador', async () => {
    const { page, signIn, navigateByUrl } = createPage({ homeRoute: '/administracion' });
    signIn.mockResolvedValue(undefined);

    page.form.setValue({ email: 'admin@mingo.test', password: '12345678' });
    await page.submit();

    expect(navigateByUrl).toHaveBeenCalledWith('/administracion');
  });

  it('respeta returnUrl cuando es una ruta interna', async () => {
    const { page, signIn, navigateByUrl } = createPage({
      queryParams: { returnUrl: '/tareas' },
    });
    signIn.mockResolvedValue(undefined);

    page.form.setValue({ email: 'ana@universidad.edu', password: '12345678' });
    await page.submit();

    expect(navigateByUrl).toHaveBeenCalledWith('/tareas');
  });

  it('muestra el mensaje cuando las credenciales son incorrectas', async () => {
    const { page, signIn } = createPage();
    signIn.mockRejectedValue(new Error('Correo o contrasena incorrectos.'));

    page.form.setValue({ email: 'ana@universidad.edu', password: '12345678' });
    await page.submit();

    expect(page.errorMessage()).toBe('Correo o contrasena incorrectos.');
  });
});
