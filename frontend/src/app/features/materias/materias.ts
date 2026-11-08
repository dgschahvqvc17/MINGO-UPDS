import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-materias',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Materias"
      icon="bi-journal-bookmark"
      description="Registro y administracion de materias, unidades y docentes."
    />
  `,
})
export class MateriasPage {}
