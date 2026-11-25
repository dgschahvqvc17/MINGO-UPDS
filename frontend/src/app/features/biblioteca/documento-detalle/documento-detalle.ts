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
import { EMPTY, Subscription, catchError, map, switchMap, take, takeWhile, timer } from 'rxjs';
import {
  DocumentoService,
  type Documento,
  type DocumentoMateriaResumen,
  type EstadoProcesamiento,
} from '../../../core/services/documento.service';
import { AuthService } from '../../../core/services/auth.service';
import { ROLES_GESTION_ACADEMICA } from '../../../core/models/dominio.models';
import { mensajeDeErrorHttp } from '../../../core/utils/http-error';
import { CardComponent } from '../../../shared/components/card/card.component';

const INTERVALO_SEGUIMIENTO_MS = 3000;
const MAXIMO_INTENTOS_SEGUIMIENTO = 20;

@Component({
  selector: 'app-documento-detalle',
  imports: [RouterLink, DatePipe, CardComponent],
  templateUrl: './documento-detalle.html',
  styleUrl: './documento-detalle.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentoDetallePage {
  private readonly documentoService = inject(DocumentoService);
  private readonly authService = inject(AuthService);
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
  readonly procesando = signal(false);

  private seguimiento: Subscription | null = null;

  readonly puedeGestionar = computed(() =>
    ROLES_GESTION_ACADEMICA.includes(this.authService.role() as (typeof ROLES_GESTION_ACADEMICA)[number]),
  );

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

          if (this.documentoService.estaEnProceso(documento.estado_procesamiento)) {
            this.seguirProcesamiento(documento.id);
          }
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

  puedeProcesar(): boolean {
    const documento = this.documento();
    return documento
      ? this.documentoService.puedeProcesar(documento.estado_procesamiento)
      : false;
  }

  textoProcesar(): string {
    const documento = this.documento();
    return documento
      ? this.documentoService.textoProcesar(documento.estado_procesamiento)
      : 'Procesar';
  }

  procesar(): void {
    const documento = this.documento();
    if (!documento || !this.puedeGestionar() || this.procesando() || !this.puedeProcesar()) {
      return;
    }

    this.procesando.set(true);
    this.errorAccion.set(null);

    this.documentoService
      .procesar(documento.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ estado }) => {
          this.procesando.set(false);
          this.aplicarCambios({
            estado_procesamiento: estado,
            motivo_error: null,
          });
          this.seguirProcesamiento(documento.id);
        },
        error: (error: unknown) => {
          this.procesando.set(false);
          this.errorAccion.set(
            mensajeDeErrorHttp(error, 'No se pudo iniciar el procesamiento del documento.'),
          );
        },
      });
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
    if (this.puedeGestionar()) {
      this.confirmandoEliminar.set(true);
    }
  }

  cancelarEliminar(): void {
    this.confirmandoEliminar.set(false);
  }

  eliminar(): void {
    const documento = this.documento();
    if (!documento || !this.puedeGestionar() || this.eliminando()) {
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

  private seguirProcesamiento(documentoId: string): void {
    this.seguimiento?.unsubscribe();

    this.seguimiento = timer(0, INTERVALO_SEGUIMIENTO_MS)
      .pipe(
        switchMap(() =>
          this.documentoService.obtenerEstado(documentoId).pipe(catchError(() => EMPTY)),
        ),
        take(MAXIMO_INTENTOS_SEGUIMIENTO),
        takeWhile(
          (estado) => this.documentoService.estaEnProceso(estado.estado_procesamiento),
          true,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (estado) => this.aplicarEstado(estado),
        complete: () => {
          this.seguimiento = null;
        },
      });
  }

  private aplicarEstado(estado: EstadoProcesamiento): void {
    this.aplicarCambios({
      estado_procesamiento: estado.estado_procesamiento,
      motivo_error: estado.motivo_error,
      numero_paginas: estado.numero_paginas,
      fecha_actualizacion: estado.fecha_actualizacion,
    });
  }

  private aplicarCambios(cambios: Partial<Documento>): void {
    this.documento.update((actual) => (actual ? { ...actual, ...cambios } : actual));
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
