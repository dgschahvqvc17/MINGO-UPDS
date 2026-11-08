import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../core/services/auth.service';

interface NavItem {
  label: string;
  path: string;
  icon: string;
  adminOnly?: boolean;
  ai?: boolean;
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
    ],
  },
  {
    title: 'Aprendizaje',
    items: [
      { label: 'Biblioteca', path: '/biblioteca', icon: 'bi-folder2-open' },
      { label: 'Centro de estudio', path: '/centro-estudio', icon: 'bi-mortarboard' },
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
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent {
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly menuOpen = signal(false);
  readonly role = this.authService.role;
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

  readonly sectionTitle = computed(() => {
    const url = this.currentUrl() ?? '';
    const match = NAV_SECTIONS.flatMap((section) => section.items).find((item) =>
      url.startsWith(item.path),
    );

    return match?.label ?? 'Panel academico';
  });

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
    await this.router.navigate(['/auth/login']);
  }
}
