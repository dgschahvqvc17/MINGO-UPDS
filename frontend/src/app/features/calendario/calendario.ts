import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-calendario',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Calendario academico"
      icon="bi-calendar3"
      description="Vista centralizada de entregas, examenes y sesiones de estudio."
    />
  `,
})
export class CalendarioPage {}