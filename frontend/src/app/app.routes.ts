import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { ShellComponent } from './layout/shell';

export const routes: Routes = [
  {
    path: 'auth/login',
    loadComponent: () => import('./features/auth/login/login').then((m) => m.LoginPage),
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard').then((m) => m.DashboardPage),
      },
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
      {
        path: 'administracion',
        canActivate: [roleGuard],
        data: { roles: ['administrador'] },
        loadComponent: () =>
          import('./features/administracion/administracion').then((m) => m.AdministracionPage),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
