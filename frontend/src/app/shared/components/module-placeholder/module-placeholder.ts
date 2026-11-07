import { Component, input } from '@angular/core';

/**
 * Marcador visual para modulos que se implementaran en los proximos sprints.
 */
@Component({
  selector: 'app-module-placeholder',
  template: `
    <section class="py-4">
      <div class="card border-0 shadow-sm">
        <div class="card-body text-center py-5 px-3">
          <i class="bi {{ icon() }} display-4 text-primary"></i>
          <h1 class="h3 mt-3 mb-2">{{ title() }}</h1>
          <p class="text-secondary mb-3">{{ description() }}</p>
          <span class="badge text-bg-light border">Modulo en construccion</span>
        </div>
      </div>
    </section>
  `,
})
export class ModulePlaceholder {
  readonly title = input.required<string>();
  readonly icon = input<string>('bi-grid');
  readonly description = input<string>('');
}
