import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { NotificacionService } from '../core/services/notificacion.service';
import { AyudanteFlotanteComponent } from '../shared/components/ayudante-flotante/ayudante-flotante.component';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  adminOnly?: boolean;
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
      { label: 'Tarjetas de memoria', path: '/tarjetas-memoria', icon: 'bi-collection' },
      { label: 'Planes de estudio', path: '/planes-estudio', icon: 'bi-calendar2-week' },
      { label: 'Objetivos y progreso', path: '/progreso', icon: 'bi-graph-up' },
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

  readonly menuOpen = signal(false);
  readonly notificacionesNoLeidas = this.notificacionService.noLeidas;
  readonly collapsed = signal(false);
  readonly role = this.authService.role;
  readonly roleLabel = computed(() => {
    const role = this.role();
    return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Estudiante';
  });
  readonly fullName = this.authService.fullName;
  readonly isAdmin = computed(() => this.role() === 'administrador');

  readonly email = computed(
    () => this.authService.profile()?.correo ?? this.authService.user()?.email ?? '',
  );

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

  readonly navSections = computed(() =>
    NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.adminOnly || this.isAdmin()),
    })).filter((section) => section.items.length > 0),
  );

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  private readonly activeNavItem = computed(() => {
    const url = this.currentUrl() ?? '';

    return NAV_SECTIONS.flatMap((section) => section.items).find((item) =>
      url.startsWith(item.path),
    );
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
