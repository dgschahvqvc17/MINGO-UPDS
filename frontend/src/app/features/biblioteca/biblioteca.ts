import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-biblioteca',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Biblioteca inteligente"
      icon="bi-folder2-open"
      description="Carga y organizacion de documentos academicos por materia."
    />
  `,
})
export class BibliotecaPage {}