import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-asistente-ia',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Asistente MINGO"
      icon="bi-stars"
      description="Chat academico con RAG, resumenes y planificacion de estudio."
    />
  `,
})
export class AsistenteIaPage {}
