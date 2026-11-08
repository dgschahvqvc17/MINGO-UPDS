import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-centro-estudio',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Centro de estudio"
      icon="bi-mortarboard"
      description="Cuestionarios, tarjetas de memoria y simulacros generados con IA."
    />
  `,
})
export class CentroEstudioPage {}
