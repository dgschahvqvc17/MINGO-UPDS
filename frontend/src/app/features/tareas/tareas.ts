import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-tareas',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Tareas y evaluaciones"
      icon="bi-check2-square"
      description="Gestion de actividades, prioridades, estados y fechas de entrega."
    />
  `,
})
export class TareasPage {}
