import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CardComponent } from '../../../../shared/components/card/card.component';
import {
  DocumentoService,
  type Documento,
  type DocumentoMateriaResumen,
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
  imports: [CardComponent, RouterLink],
  templateUrl: './documento-card.html',
  styleUrl: './documento-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoCardComponent {
  private readonly documentoService = inject(DocumentoService);

  readonly documento = input.required<Documento>();
  readonly descargando = input(false);
  readonly eliminando = input(false);

  readonly descargar = output<Documento>();
  readonly eliminar = output<Documento>();

  readonly confirmandoEliminar = signal(false);

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

  estadoClase(): string {
    return this.documentoService.estadoClase(this.documento().estado_procesamiento);
  }

  formatoTexto(): string {
    return this.documentoService.formatoTexto(
      this.documento().tipo_archivo,
      this.documento().nombre_archivo,
    );
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

  pedirConfirmacion(): void {
    this.confirmandoEliminar.set(true);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  confirmarEliminar(): void {
    this.confirmandoEliminar.set(false);
    this.eliminar.emit(this.documento());
  }
}
