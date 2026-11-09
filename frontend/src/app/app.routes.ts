import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  // Ruta pública para login
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginPage),
  },

  // Ruta pública para showcase (solo para desarrollo/demo)
  {
    path: 'ui-showcase',
    loadComponent: () => import('./ui-showcase.component').then((m) => m.UiShowcaseComponent),
  },

  // Área protegida - requiere autenticación
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/app-shell.component').then((m) => m.AppShellComponent),
    children: [
      // Redirección según rol del usuario
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard',
      },

      // Dashboard para estudiantes
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },

      // Administración (solo para administradores)
      {
        path: 'administracion',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import('./features/administracion/administracion').then((m) => m.AdministracionPage),
      },
      
      // Rutas de gestión de usuarios dentro de administración
      {
        path: 'administracion/usuarios/:id',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import('./features/administracion/usuario-detalle/usuario-detalle').then((m) => m.UsuarioDetallePage),
      },
      {
        path: 'administracion/usuarios/:id/roles',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import('./features/administracion/usuario-roles/usuario-roles').then((m) => m.UsuarioRolesPage),
      },

      // Otras rutas protegidas
      {
        path: 'materias',
        loadComponent: () => import('./features/materias/materias').then((m) => m.MateriasPage),
      },

      {
        path: 'tareas',
        loadComponent: () => import('./features/tareas/tareas').then((m) => m.TareasPage),
      },

      {
        path: 'calendario',
        loadComponent: () =>
          import('./features/calendario/calendario').then((m) => m.CalendarioPage),
      },

      {
        path: 'biblioteca',
        loadComponent: () =>
          import('./features/biblioteca/biblioteca').then((m) => m.BibliotecaPage),
      },

      {
        path: 'centro-estudio',
        loadComponent: () =>
          import('./features/centro-estudio/centro-estudio').then((m) => m.CentroEstudioPage),
      },

      {
        path: 'asistente-ia',
        loadComponent: () =>
          import('./features/asistente-ia/asistente-ia').then((m) => m.AsistenteIaPage),
      },
    ],
  },

  // Redirección por defecto - si no está autenticado va a login
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },

  // Catch-all: redirige a login (para rutas no encontradas)
  {
    path: '**',
    redirectTo: 'auth/login',
  },
];
