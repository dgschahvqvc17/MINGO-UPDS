import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { CardComponent } from '../../../../shared/components/card/card.component';
import {
  DocumentoService,
  type Documento,
  type DocumentoMateriaResumen,
  type EstadoDocumento,
} from '../../../../core/services/documento.service';

const ICONOS_POR_EXTENSION: Record<string, string> = {
  pdf: 'bi-file-earmark-pdf',
  doc: 'bi-file-earmark-word',
  docx: 'bi-file-earmark-word',
  ppt: 'bi-file-earmark-slides',
  pptx: 'bi-file-earmark-slides',
  txt: 'bi-file-earmark-text',
};

@Component({
  selector: 'app-documento-card',
  imports: [CardComponent],
  templateUrl: './documento-card.html',
  styleUrl: './documento-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoCardComponent {
  private readonly documentoService = inject(DocumentoService);

  readonly documento = input.required<Documento>();

  readonly materia = computed<DocumentoMateriaResumen | null>(() => {
    const materias = this.documento().materias;
    if (!materias) {
      return null;
    }

    return Array.isArray(materias) ? (materias[0] ?? null) : materias;
  });

  readonly colorMateria = computed(() => this.materia()?.color ?? '#2563eb');

  icono(): string {
    const extension = this.documentoService.obtenerExtension(this.documento().nombre_archivo);
    return ICONOS_POR_EXTENSION[extension.replace('.', '')] ?? 'bi-file-earmark';
  }

  estadoTexto(): string {
    return this.documentoService.estadoTexto(this.documento().estado_procesamiento);
  }

  estadoClase(estado: EstadoDocumento = this.documento().estado_procesamiento): string {
    const clases: Record<EstadoDocumento, string> = {
      pendiente: 'doc-badge--muted',
      en_cola: 'doc-badge--info',
      procesando: 'doc-badge--info',
      procesado: 'doc-badge--success',
      error: 'doc-badge--danger',
    };

    return clases[estado];
  }

  tamanoTexto(): string {
    return this.documentoService.formatearTamano(this.documento().tamano);
  }

  fechaTexto(): string {
    return new Date(this.documento().fecha_carga).toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }
}
