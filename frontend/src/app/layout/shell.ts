import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  adminOnly?: boolean;
}

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly role = this.authService.role;

  private readonly allNavItems: NavItem[] = [
    { label: 'Dashboard', path: '/dashboard', icon: 'bi-speedometer2' },
    { label: 'Materias', path: '/materias', icon: 'bi-journal-bookmark' },
    { label: 'Tareas', path: '/tareas', icon: 'bi-check2-square' },
    { label: 'Calendario', path: '/calendario', icon: 'bi-calendar3' },
    { label: 'Biblioteca', path: '/biblioteca', icon: 'bi-folder2-open' },
    { label: 'Centro de estudio', path: '/centro-estudio', icon: 'bi-mortarboard' },
    { label: 'Asistente IA', path: '/asistente-ia', icon: 'bi-stars' },
    {
      label: 'Administracion',
      path: '/administracion',
      icon: 'bi-shield-lock',
      adminOnly: true,
    },
  ];

  readonly navItems = computed(() =>
    this.allNavItems.filter((item) => !item.adminOnly || this.role() === 'administrador'),
  );

  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
