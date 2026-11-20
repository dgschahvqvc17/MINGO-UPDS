import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { DocumentoService, type Documento } from '../../core/services/documento.service';
import {
  PROFUNDIDADES_RESUMEN,
  ResumenService,
  type ProfundidadResumen,
  type ResumenDocumento,
} from '../../core/services/resumen.service';
import { mensajeDeErrorHttp } from '../../core/utils/http-error';
import { ChatComponent } from './components/chat/chat.component';
import { MascotaAgenteComponent } from '../../shared/components/mascota-agente/mascota-agente.component';
import { crearEstadoMascota } from '../../shared/components/mascota-agente/estado-mascota';

const LIMITE_DOCUMENTOS = 100;

type PestanaAsistente = 'chat' | 'resumenes';

interface OpcionProfundidad {
  valor: ProfundidadResumen;
  etiqueta: string;
  descripcion: string;
}

/** Pagina del asistente academico: chat RAG (HU12) y resumenes (HU10). */
@Component({
  selector: 'app-asistente-ia',
  imports: [DatePipe, RouterLink, ChatComponent, MascotaAgenteComponent],
  templateUrl: './asistente-ia.html',
  styleUrl: './asistente-ia.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsistenteIaPage {
  private readonly documentoService = inject(DocumentoService);
  private readonly resumenService = inject(ResumenService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pestana = signal<PestanaAsistente>('chat');

  readonly documentos = signal<Documento[]>([]);
  readonly cargandoDocumentos = signal(true);
  readonly errorDocumentos = signal<string | null>(null);
  readonly documentoId = signal('');
  readonly profundidad = signal<ProfundidadResumen>('media');
  readonly resumen = signal<ResumenDocumento | null>(null);
  readonly cargandoResumen = signal(false);
  readonly errorResumen = signal<string | null>(null);
  readonly mensaje = signal<string | null>(null);

  readonly opcionesProfundidad: OpcionProfundidad[] = [
    { valor: 'breve', etiqueta: 'Breve', descripcion: 'Una idea general en pocos renglones.' },
    { valor: 'media', etiqueta: 'Media', descripcion: 'Equilibrio entre detalle y rapidez.' },
    { valor: 'detallada', etiqueta: 'Detallada', descripcion: 'Desarrollo amplio con más conceptos.' },
  ];

  readonly documentoSeleccionado = computed(
    () => this.documentos().find((documento) => documento.id === this.documentoId()) ?? null,
  );

  readonly sinDocumentos = computed(
    () =>
      !this.cargandoDocumentos() &&
      !this.errorDocumentos() &&
      this.documentos().length === 0,
  );

  /** La mascota acompaña la generación de resúmenes con su estado real. */
  private readonly controlMascota = crearEstadoMascota(this.cargandoResumen, this.destroyRef);
  readonly estadoMascota = this.controlMascota.estado;

  constructor() {
    if (this.pestana() === 'resumenes') {
      this.cargarDocumentos();
    }
  }

  cambiarPestana(pestana: PestanaAsistente): void {
    this.pestana.set(pestana);

    if (
      pestana === 'resumenes' &&
      this.documentos().length === 0 &&
      !this.cargandoDocumentos()
    ) {
      this.cargarDocumentos();
    }
  }

  cargarDocumentos(): void {
    this.cargandoDocumentos.set(true);
    this.errorDocumentos.set(null);

    this.documentoService
      .listar({ estado: 'procesado', limit: LIMITE_DOCUMENTOS })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoDocumentos.set(false)),
      )
      .subscribe({
        next: ({ documentos }) => {
          this.documentos.set(documentos);

          if (documentos.length > 0) {
            this.documentoId.set(documentos[0].id);
            this.cargarResumenGuardado();
          }
        },
        error: (error: unknown) => {
          this.errorDocumentos.set(
            mensajeDeErrorHttp(error, 'No se pudieron cargar tus documentos procesados.'),
          );
        },
      });
  }

  alCambiarDocumento(evento: Event): void {
    this.documentoId.set((evento.target as HTMLSelectElement).value);
    this.resumen.set(null);
    this.errorResumen.set(null);
    this.mensaje.set(null);
    this.cargarResumenGuardado();
  }

  alCambiarProfundidad(evento: Event): void {
    const valor = (evento.target as HTMLInputElement).value as ProfundidadResumen;

    if (PROFUNDIDADES_RESUMEN.includes(valor)) {
      this.profundidad.set(valor);
      this.mensaje.set(null);
    }
  }

  cargarResumenGuardado(): void {
    const documentoId = this.documentoId();
    if (!documentoId) {
      return;
    }

    this.cargandoResumen.set(true);
    this.errorResumen.set(null);
    this.mensaje.set(null);
    this.controlMascota.reiniciar();

    this.resumenService
      .obtenerGuardado(documentoId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoResumen.set(false)),
      )
      .subscribe({
        next: (resumen) => {
          this.resumen.set(resumen);
          if (!resumen) {
            this.mensaje.set('Todavía no hay un resumen guardado para este documento.');
          }
        },
        error: (error: unknown) => {
          this.errorResumen.set(
            mensajeDeErrorHttp(error, 'No se pudo consultar el resumen guardado.'),
          );
        },
      });
  }

  generar(): void {
    const documentoId = this.documentoId();
    if (!documentoId || this.cargandoResumen()) {
      return;
    }

    this.cargandoResumen.set(true);
    this.errorResumen.set(null);
    this.mensaje.set(null);
    this.controlMascota.reiniciar();

    this.resumenService
      .generar({
        documento_id: documentoId,
        profundidad: this.profundidad(),
        guardar: true,
      })
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoResumen.set(false)),
      )
      .subscribe({
        next: (resumen) => {
          this.resumen.set(resumen);
          this.mensaje.set(
            resumen.reutilizado
              ? 'Se reutilizó el resumen guardado para este contenido.'
              : 'Resumen generado y guardado correctamente.',
          );
          this.controlMascota.anunciarResultado();
        },
        error: (error: unknown) => {
          this.resumen.set(null);
          this.errorResumen.set(
            mensajeDeErrorHttp(error, 'No se pudo generar el resumen. Inténtalo de nuevo.'),
          );
        },
      });
  }

  etiquetaProfundidad(profundidad: ProfundidadResumen): string {
    return this.resumenService.etiquetaProfundidad(profundidad);
  }

  formatoDocumento(documento: Documento): string {
    return this.documentoService.formatoTexto(documento.tipo_archivo, documento.nombre_archivo);
  }
}
