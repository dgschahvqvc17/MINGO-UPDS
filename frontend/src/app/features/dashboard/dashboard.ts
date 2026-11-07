import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-dashboard',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Dashboard"
      icon="bi-speedometer2"
      description="Resumen academico, tareas pendientes y proximos examenes."
    />
  `,
})
export class DashboardPage {}