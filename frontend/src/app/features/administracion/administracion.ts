import { Component } from '@angular/core';
import { ModulePlaceholder } from '../../shared/components/module-placeholder/module-placeholder';

@Component({
  selector: 'app-administracion',
  imports: [ModulePlaceholder],
  template: `
    <app-module-placeholder
      title="Administracion"
      icon="bi-shield-lock"
      description="Gestion de usuarios, roles y supervision de la plataforma."
    />
  `,
})
export class AdministracionPage {}
