import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TitleCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-dashboard',
  imports: [TitleCasePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly profile = this.authService.profile;
  readonly userRole = this.authService.role;
  readonly userName = this.authService.fullName;

  // Datos de ejemplo para el dashboard
  readonly welcomeMessage = computed(() => {
    const role = this.userRole();
    const name = this.userName() || 'Estudiante';

    switch (role) {
      case 'administrador':
        return `Hola ${name}, panel de administración`;
      default:
        return `¡Hola ${name}! Tu espacio de estudio`;
    }
  });

  // Funciones de navegación rápida según rol
  getQuickLinks() {
    const role = this.userRole();

    switch (role) {
      case 'administrador':
        return [
          {
            path: '/administracion',
            icon: 'bi-gear',
            label: 'Administración',
            description: 'Gestionar usuarios y sistema',
          },
          {
            path: '/materias',
            icon: 'bi-book',
            label: 'Materias',
            description: 'Ver todas las materias',
          },
          {
            path: '/tareas',
            icon: 'bi-clipboard-check',
            label: 'Tareas',
            description: 'Revisar tareas del sistema',
          },
        ];
      default: // estudiante
        return [
          {
            path: '/materias',
            icon: 'bi-book',
            label: 'Mis materias',
            description: 'Materias inscritas',
          },
          {
            path: '/tareas',
            icon: 'bi-clipboard-check',
            label: 'Tareas pendientes',
            description: 'Ver próximas tareas',
          },
          {
            path: '/calendario',
            icon: 'bi-calendar',
            label: 'Calendario',
            description: 'Eventos y fechas importantes',
          },
          {
            path: '/centro-estudio',
            icon: 'bi-laptop',
            label: 'Centro de estudio',
            description: 'Espacio personalizado',
          },
        ];
    }
  }

  getRoleIcon(): string {
    switch (this.userRole()) {
      case 'administrador':
        return 'bi bi-shield-check';
      default:
        return 'bi bi-person';
    }
  }

  navigateTo(path: string): void {
    this.router.navigate([path]);
  }
}
