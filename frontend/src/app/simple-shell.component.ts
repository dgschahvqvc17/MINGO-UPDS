import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-simple-shell',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="simple-shell">
      <header class="simple-header bg-surface border-bottom border-mingo p-4">
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
          <nav>
            <a routerLink="/" class="btn btn-outline-secondary btn-sm me-2">Inicio</a>
            <a routerLink="/ui-showcase" class="btn btn-primary btn-sm">Ver Diseño</a>
          </nav>
        </div>
      </header>

      <main class="simple-main py-6">
        <div class="container">
          <router-outlet></router-outlet>
        </div>
      </main>

      <footer class="simple-footer border-top border-mingo p-4">
        <div class="container text-center">
          <p class="text-muted small mb-0">
            MINGO LMS - Plataforma educativa con IA • Sistema de diseño v2.0
          </p>
        </div>
      </footer>
    </div>
  `,
  styles: [
    `
      .simple-shell {
        min-height: 100vh;
        display: flex;
        flex-direction: column;
      }

      .simple-main {
        flex: 1;
      }

      .simple-header,
      .simple-footer {
        background: var(--mingo-surface);
      }
    `,
  ],
})
export class SimpleShellComponent {}
