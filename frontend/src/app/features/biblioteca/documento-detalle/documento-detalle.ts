import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { map, switchMap } from 'rxjs/operators';
import {
  DocumentoService,
  type Documento,
  type DocumentoMateriaResumen,
} from '../../../core/services/documento.service';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { CardComponent } from '../../../shared/components/card/card.component';

@Component({
  selector: 'app-documento-detalle',
  imports: [RouterLink, DatePipe, CardComponent],
  templateUrl: './documento-detalle.html',
  styleUrl: './documento-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoDetallePage {
  private readonly documentoService = inject(DocumentoService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly documento = signal<Documento | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly errorAccion = signal<string | null>(null);
  readonly descargando = signal(false);
  readonly eliminando = signal(false);
  readonly confirmandoEliminar = signal(false);

  readonly materia = computed<DocumentoMateriaResumen | null>(() => {
    const materias = this.documento()?.materias;
    if (!materias) {
      return null;
    }

    return Array.isArray(materias) ? (materias[0] ?? null) : materias;
  });

  readonly formato = computed(() => {
    const documento = this.documento();
    if (!documento) {
      return '';
    }

    return this.documentoService.formatoTexto(documento.tipo_archivo, documento.nombre_archivo);
  });

  readonly tamano = computed(() => {
    const documento = this.documento();
    return documento ? this.documentoService.formatearTamano(documento.tamano) : '';
  });

  constructor() {
    this.cargar();
  }

  cargar(): void {
    this.loading.set(true);
    this.error.set(null);

    this.route.paramMap
      .pipe(
        map((parametros) => parametros.get('id') ?? ''),
        switchMap((id) => this.documentoService.obtener(id)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (documento) => {
          this.documento.set(documento);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.documento.set(null);
          this.error.set(mensajeDeErrorHttp(error, 'No se pudo cargar el documento.'));
          this.loading.set(false);
        },
      });
  }

  estadoTexto(): string {
    const documento = this.documento();
    return documento ? this.documentoService.estadoTexto(documento.estado_procesamiento) : '';
  }

  estadoClase(): string {
    const documento = this.documento();
    return documento ? this.documentoService.estadoClase(documento.estado_procesamiento) : '';
  }

  descargar(): void {
    const documento = this.documento();
    if (!documento || this.descargando()) {
      return;
    }

    this.descargando.set(true);
    this.errorAccion.set(null);

    this.documentoService
      .urlDescarga(documento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ downloadUrl }) => {
          this.iniciarDescarga(downloadUrl, documento.nombre_archivo);
          this.descargando.set(false);
        },
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo descargar el documento.'),
          );
          this.descargando.set(false);
        },
      });
  }

  pedirConfirmacion(): void {
    this.confirmandoEliminar.set(true);
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  eliminar(): void {
    const documento = this.documento();
    if (!documento || this.eliminando()) {
      return;
    }

    this.eliminando.set(true);
    this.confirmandoEliminar.set(false);
    this.errorAccion.set(null);

    this.documentoService
      .eliminar(documento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.router.navigate(['/biblioteca']),
        error: (error: unknown) => {
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo eliminar el documento.'),
          );
          this.eliminando.set(false);
        },
      });
  }

  private iniciarDescarga(url: string, nombreArchivo: string): void {
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombreArchivo;
    enlace.rel = 'noopener';
    enlace.style.display = 'none';
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
  }
}
