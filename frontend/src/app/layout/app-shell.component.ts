import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-app-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="app-shell">
      <!-- Header con navegación y usuario -->
      <header class="app-header bg-surface border-bottom border-mingo p-4 glass">
        <div class="container d-flex align-items-center justify-content-between">
          <div class="d-flex align-items-center gap-3">
            <div class="icon-badge icon-badge--gradient">
              <i class="bi bi-mortarboard-fill"></i>
            </div>
            <div>
              <h1 class="h4 mb-0 text-white">MINGO LMS</h1>
              <small class="text-muted">Plataforma académica inteligente</small>
            </div>
          </div>

          <div class="d-flex align-items-center gap-3">
            <!-- Información del usuario -->
            @if (authService.profile(); as profile) {
              <div class="d-flex align-items-center gap-2">
                <span class="badge badge-role">
                  <i class="bi bi-person-badge me-1"></i>
                  {{ profile.role }}
                </span>

                <div class="user-chip d-flex align-items-center gap-2">
                  <span class="user-avatar">
                    {{ getInitials(profile.nombre + ' ' + profile.apellido) }}
                  </span>
                  <span class="user-meta d-none d-md-flex flex-column">
                    <strong>{{ profile.nombre }} {{ profile.apellido }}</strong>
                    <small>{{ profile.correo }}</small>
                  </span>
                </div>

                <button
                  class="btn-icon btn-icon--danger"
                  type="button"
                  aria-label="Cerrar sesión"
                  title="Cerrar sesión"
                  (click)="logout()"
                  [disabled]="logoutLoading()"
                >
                  @if (logoutLoading()) {
                    <span class="spinner-border spinner-border-sm" aria-hidden="true"></span>
                  } @else {
                    <i class="bi bi-box-arrow-right"></i>
                  }
                </button>
              </div>
            }
          </div>
        </div>
      </header>

      <!-- Navegación principal -->
      <nav class="app-nav border-bottom border-mingo py-2">
        <div class="container">
          <div class="d-flex gap-2">
            <a
              routerLink="/dashboard"
              routerLinkActive="active"
              class="btn btn-outline-secondary btn-sm"
            >
              <i class="bi bi-grid-1x2 me-1"></i>
              Dashboard
            </a>

            <a
              routerLink="/materias"
              routerLinkActive="active"
              class="btn btn-outline-secondary btn-sm"
            >
              <i class="bi bi-journal-bookmark me-1"></i>
              Materias
            </a>

            <a
              routerLink="/tareas"
              routerLinkActive="active"
              class="btn btn-outline-secondary btn-sm"
            >
              <i class="bi bi-check2-square me-1"></i>
              Tareas
            </a>

            <a
              routerLink="/biblioteca"
              routerLinkActive="active"
              class="btn btn-outline-secondary btn-sm"
            >
              <i class="bi bi-folder2-open me-1"></i>
              Biblioteca
            </a>

            <a
              routerLink="/asistente-ia"
              routerLinkActive="active"
              class="btn btn-outline-secondary btn-sm"
            >
              <i class="bi bi-stars me-1"></i>
              Asistente IA
            </a>

            @if (authService.role() === 'administrador') {
              <a
                routerLink="/administracion"
                routerLinkActive="active"
                class="btn btn-outline-primary btn-sm"
              >
                <i class="bi bi-shield-lock me-1"></i>
                Administración
              </a>
            }
          </div>
        </div>
      </nav>

      <!-- Contenido principal -->
      <main class="app-main py-6">
        <div class="container">
          <router-outlet></router-outlet>
        </div>
      </main>

      <!-- Footer -->
      <footer class="app-footer border-top border-mingo p-4">
        <div class="container text-center">
          <p class="text-muted small mb-0">
            MINGO LMS - Plataforma educativa con IA • Sistema de diseño v2.0 •
            <span class="text-ai">
              <i class="bi bi-shield-lock me-1"></i>
              Sesión segura
            </span>
          </p>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .app-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .app-main {
        flex: 1;
      }

      .app-header {
        background: var(--mingo-surface);
        backdrop-filter: blur(12px);
      }

      .app-nav {
        background: rgba(10, 17, 40, 0.9);
      }

      .user-chip {
        padding: 0.3rem 0.5rem 0.3rem 0.3rem;
        border: 1px solid var(--mingo-border);
        border-radius: 999px;
        background: rgba(148, 163, 184, 0.06);
      }

      .user-avatar {
        display: grid;
        place-items: center;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--mingo-primary), var(--mingo-ai));
        color: #ffffff;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.04em;
      }

      .user-meta {
        flex-direction: column;
        min-width: 0;
        padding-right: 0.35rem;
        line-height: 1.2;
        text-align: left;
      }

      .user-meta strong,
      .user-meta small {
        max-width: 160px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .user-meta strong {
        color: #ffffff;
        font-size: 0.8rem;
        font-weight: 600;
      }

      .user-meta small {
        color: var(--mingo-text-muted);
        font-size: 0.68rem;
      }

      .btn-outline-secondary.active {
        background: var(--mingo-primary-soft);
        border-color: var(--mingo-primary);
        color: var(--mingo-text);
      }

      .btn-outline-primary.active {
        background: var(--mingo-primary-soft);
        border-color: var(--mingo-primary);
        color: var(--mingo-text);
      }

      .spinner-border {
        width: 1rem;
        height: 1rem;
        border-width: 0.15em;
      }
    `,
  ],
})
export class AppShellComponent {
  authService = inject(AuthService);
  logoutLoading = signal(false);

  getInitials(name: string): string {
    const parts = name.split(/\s+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }

  async logout(): Promise<void> {
    this.logoutLoading.set(true);
    try {
      await this.authService.signOut();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      this.logoutLoading.set(false);
    }
  }
}
