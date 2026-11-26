import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { ROLES_GESTION_ACADEMICA, RolUsuario } from '../core/models/dominio.models';
import { AuthService } from '../core/services/auth.service';
import { NotificacionService } from '../core/services/notificacion.service';
import { PreferenciasInterfazService } from '../core/services/preferencias-interfaz.service';
import { AyudanteFlotanteComponent } from '../shared/components/ayudante-flotante/ayudante-flotante.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  adminOnly?: boolean;
  roles?: readonly RolUsuario[];
  ai?: boolean;
  badgeNotificaciones?: boolean;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Principal',
    items: [
      { label: 'Dashboard', path: '/dashboard', icon: 'bi-grid-1x2' },
      { label: 'Materias', path: '/materias', icon: 'bi-journal-bookmark' },
      { label: 'Tareas', path: '/tareas', icon: 'bi-check2-square' },
      { label: 'Calendario', path: '/calendario', icon: 'bi-calendar3' },
      {
        label: 'Notificaciones',
        path: '/notificaciones',
        icon: 'bi-bell',
        badgeNotificaciones: true,
      },
    ],
  },
  {
    title: 'Aprendizaje',
    items: [
      { label: 'Biblioteca', path: '/biblioteca', icon: 'bi-folder2-open' },
      { label: 'Centro de estudio', path: '/centro-estudio', icon: 'bi-mortarboard' },
      {
        label: 'Tarjetas de memoria',
        path: '/tarjetas-memoria',
        icon: 'bi-collection',
        roles: ['estudiante', 'administrador'],
      },
      {
        label: 'Planes de estudio',
        path: '/planes-estudio',
        icon: 'bi-calendar2-week',
        roles: ['estudiante', 'administrador'],
      },
      {
        label: 'Objetivos y progreso',
        path: '/progreso',
        icon: 'bi-graph-up',
        roles: ['estudiante', 'administrador'],
      },
      { label: 'Asistente IA', path: '/asistente-ia', icon: 'bi-stars', ai: true },
    ],
  },
  {
    title: 'Sistema',
    items: [
      {
        label: 'Administracion',
        path: '/administracion',
        icon: 'bi-shield-lock',
        adminOnly: true,
      },
    ],
  },
];

@Component({
  selector: 'app-shell',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AyudanteFlotanteComponent],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly notificacionService = inject(NotificacionService);
  private readonly preferenciasInterfaz = inject(PreferenciasInterfazService);

  readonly menuOpen = signal(false);
  readonly asistenteFlotanteVisible = this.preferenciasInterfaz.asistenteFlotanteVisible;
  readonly notificacionesNoLeidas = this.notificacionService.noLeidas;
  readonly collapsed = signal(false);
  readonly role = this.authService.role;
  readonly roleLabel = computed(() => {
    const etiquetas: Record<RolUsuario, string> = {
      administrador: 'Administrador',
      docente: 'Docente',
      estudiante: 'Estudiante',
    };
    return etiquetas[this.role()];
  });
  readonly fullName = this.authService.fullName;
  readonly isAdmin = computed(() => this.role() === 'administrador');
  readonly puedeGestionar = computed(() => ROLES_GESTION_ACADEMICA.includes(this.role()));

  readonly email = computed(() => {
    const profile = this.authService.profile();
    return profile?.correo ?? profile?.email ?? this.authService.user()?.email ?? '';
  });

  readonly initials = computed(() => {
    const name = this.fullName();
    if (!name) {
      return 'MI';
    }

    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  });

  readonly navSections = computed(() => {
    const role = this.role();

    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter(
        (item) =>
          (!item.adminOnly || this.isAdmin()) &&
          (!item.roles || item.roles.includes(role)),
      ),
    })).filter((section) => section.items.length > 0);
  });

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly activeNavItem = computed(() => {
    const url = this.currentUrl() ?? '';

    return this.navSections()
      .flatMap((section) => section.items)
      .find((item) => url.startsWith(item.path));
  });

  readonly sectionTitle = computed(() => this.activeNavItem()?.label ?? 'Panel académico');
  readonly sectionIcon = computed(() => this.activeNavItem()?.icon ?? 'bi-mortarboard');

  constructor() {
    this.notificacionService
      .contarNoLeidas()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => undefined,
        error: () => undefined,
      });
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  toggleCollapsed(): void {
    this.collapsed.update((value) => !value);
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
