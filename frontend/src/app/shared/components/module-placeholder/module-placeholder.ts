import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Marcador visual para modulos que se implementaran en los proximos sprints.
 */
@Component({
  selector: 'app-module-placeholder',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="py-2">
      <div class="app-card app-card--hover placeholder-card">
        <div class="card-body d-flex flex-column align-items-center text-center p-4 p-md-5">
          <span class="icon-badge icon-badge--ai icon-badge--lg mb-3">
            <i class="bi {{ icon() }}" aria-hidden="true"></i>
          </span>

          <span class="ai-badge mb-3">
            <i class="bi bi-stars" aria-hidden="true"></i> Modulo en construccion
          </span>

          <h1 class="page-title mb-2">{{ title() }}</h1>
          <p class="placeholder-description text-muted-soft mb-4">{{ description() }}</p>

          <div class="d-flex flex-wrap justify-content-center gap-2">
            <a class="btn btn-primary" routerLink="/dashboard">
              <i class="bi bi-arrow-left me-1" aria-hidden="true"></i>
              Volver al dashboard
            </a>
            <a class="btn btn-outline-secondary" routerLink="/asistente-ia">
              <i class="bi bi-stars me-1" aria-hidden="true"></i>
              Explorar el asistente IA
            </a>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [
    `
      .placeholder-card {
        max-width: 40rem;
        margin-inline: auto;
      }

      .placeholder-description {
        max-width: 30rem;
        line-height: 1.6;
      }
    `,
  ],
})
export class ModulePlaceholder {
  readonly title = input.required<string>();
  readonly icon = input<string>('bi-grid');
  readonly description = input<string>('');
}
