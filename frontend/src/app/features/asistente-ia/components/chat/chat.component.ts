import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import type {
  Conversacion,
  Mensaje,
  ReferenciaRespuesta,
} from '../../../../core/models/dominio.models';
import { ChatService } from '../../../../core/services/chat.service';
import { DocumentoService, type Documento } from '../../../../core/services/documento.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';
import { crearClaveIdempotencia } from '../../../../core/utils/idempotency-key';

const LIMITE_DOCUMENTOS = 100;
const MAXIMO_DOCUMENTOS_CHAT = 5;
const LIMITE_CONVERSACIONES = 20;
const LONGITUD_MAXIMA_MENSAJE = 4000;

type MensajeVista = Mensaje & { referencias: ReferenciaRespuesta[] };

/** Interfaz de chat academico con citas documentales (HU12). */
@Component({
  selector: 'app-chat',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatComponent {
  private readonly chatService = inject(ChatService);
  private readonly documentoService = inject(DocumentoService);
  private readonly destroyRef = inject(DestroyRef);

  /** Clave del envio pendiente: se reutiliza al reintentar la misma solicitud. */
  private claveIdempotenciaPendiente: string | null = null;
  private firmaPendiente: string | null = null;

  readonly mensajeControl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.maxLength(LONGITUD_MAXIMA_MENSAJE)],
  });

  readonly conversaciones = signal<Conversacion[]>([]);
  readonly cargandoConversaciones = signal(false);
  readonly errorConversaciones = signal<string | null>(null);
  readonly conversacionActualId = signal<string | null>(null);

  readonly mensajes = signal<MensajeVista[]>([]);
  readonly cargandoMensajes = signal(false);
  readonly errorMensajes = signal<string | null>(null);
  readonly enviando = signal(false);
  readonly errorEnvio = signal<string | null>(null);

  readonly documentos = signal<Documento[]>([]);
  readonly documentoIds = signal<string[]>([]);
  readonly cargandoDocumentos = signal(false);
  readonly errorDocumentos = signal<string | null>(null);
  readonly avisoDocumentos = signal<string | null>(null);
  readonly usarDocumentos = signal(true);

  readonly conversacionActual = computed(
    () =>
      this.conversaciones().find((conversacion) => conversacion.id === this.conversacionActualId())
      ?? null,
  );

  readonly sinConversaciones = computed(
    () =>
      !this.cargandoConversaciones() &&
      !this.errorConversaciones() &&
      this.conversaciones().length === 0,
  );

  readonly sinMensajes = computed(
    () =>
      !this.cargandoMensajes() && !this.errorMensajes() && this.mensajes().length === 0,
  );

  constructor() {
    this.cargarConversaciones();
    this.cargarDocumentos();
  }

  cargarConversaciones(): void {
    this.cargandoConversaciones.set(true);
    this.errorConversaciones.set(null);

    this.chatService
      .listar(LIMITE_CONVERSACIONES, 0)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoConversaciones.set(false)),
      )
      .subscribe({
        next: ({ data }) => this.conversaciones.set(data),
        error: () =>
          this.errorConversaciones.set('No se pudieron cargar tus conversaciones.'),
      });
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
        next: ({ documentos }) => this.documentos.set(documentos),
        error: () => this.errorDocumentos.set('No se pudieron cargar tus documentos.'),
      });
  }

  cargarHistorial(conversacionId: string): void {
    this.cargandoMensajes.set(true);
    this.errorMensajes.set(null);

    this.chatService
      .obtener(conversacionId)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.cargandoMensajes.set(false)),
      )
      .subscribe({
        next: (conversacion) => this.mensajes.set(conversacion.mensajes ?? []),
        error: () => this.errorMensajes.set('No se pudo cargar el historial de la conversación.'),
      });
  }

  seleccionarConversacion(conversacion: Conversacion): void {
    this.conversacionActualId.set(conversacion.id);
    this.errorEnvio.set(null);
    this.cargarHistorial(conversacion.id);
  }

  nuevaConversacion(): void {
    this.conversacionActualId.set(null);
    this.mensajes.set([]);
    this.errorMensajes.set(null);
    this.errorEnvio.set(null);
    this.mensajeControl.reset();
  }

  eliminarConversacion(conversacion: Conversacion, evento: Event): void {
    evento.stopPropagation();

    if (!window.confirm(`¿Eliminar la conversación «${conversacion.titulo}»?`)) {
      return;
    }

    this.chatService
      .eliminar(conversacion.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.conversacionActualId() === conversacion.id) {
            this.nuevaConversacion();
          }

          this.cargarConversaciones();
        },
        error: () => this.errorConversaciones.set('No se pudo eliminar la conversación.'),
      });
  }

  /**
   * Atiende el submit nativo del formulario sin recargar la pagina.
   */
  enviarDesdeFormulario(evento: Event): void {
    evento.preventDefault();
    this.enviar();
  }

  enviar(): void {
    const contenido = this.mensajeControl.value.trim();
    if (!contenido || this.enviando() || this.mensajeControl.invalid) {
      return;
    }

    const mensajeLocal: MensajeVista = {
      id: `temporal-${Date.now()}`,
      conversacion_id: this.conversacionActualId() ?? '',
      rol_mensaje: 'user',
      contenido,
      modelo_utilizado: null,
      fecha_creacion: new Date().toISOString(),
      referencias: [],
    };

    this.enviando.set(true);
    this.errorEnvio.set(null);
    this.mensajes.update((mensajes) => [...mensajes, mensajeLocal]);
    this.mensajeControl.reset();

    const solicitud = {
      conversacion_id: this.conversacionActualId(),
      mensaje: contenido,
      materia_id: null,
      documento_ids: this.documentoIds(),
      usar_documentos: this.usarDocumentos(),
    };
    const firma = JSON.stringify(solicitud);

    const claveIdempotencia =
      this.firmaPendiente === firma && this.claveIdempotenciaPendiente
        ? this.claveIdempotenciaPendiente
        : crearClaveIdempotencia();

    this.claveIdempotenciaPendiente = claveIdempotencia;
    this.firmaPendiente = firma;

    this.chatService
      .enviar(solicitud, claveIdempotencia)
      .pipe(
        takeUntilDestroyed(this.destroyRef),
        finalize(() => this.enviando.set(false)),
      )
      .subscribe({
        next: (respuesta) => {
          this.claveIdempotenciaPendiente = null;
          this.firmaPendiente = null;
          this.conversacionActualId.set(respuesta.conversacion_id);
          this.cargarHistorial(respuesta.conversacion_id);
          this.cargarConversaciones();
        },
        error: (error: unknown) => {
          this.mensajes.update((mensajes) =>
            mensajes.filter((mensaje) => mensaje.id !== mensajeLocal.id),
          );
          this.mensajeControl.setValue(contenido);
          this.errorEnvio.set(
            mensajeDeErrorHttp(error, 'No se pudo enviar el mensaje. Inténtalo de nuevo.'),
          );
        },
      });
  }

  alCambiarDocumentos(evento: Event): void {
    const seleccionados = Array.from(
      (evento.target as HTMLSelectElement).selectedOptions,
    ).map((opcion) => opcion.value);

    this.avisoDocumentos.set(
      seleccionados.length > MAXIMO_DOCUMENTOS_CHAT
        ? `Puedes seleccionar hasta ${MAXIMO_DOCUMENTOS_CHAT} documentos por pregunta.`
        : null,
    );
    this.documentoIds.set(seleccionados.slice(0, MAXIMO_DOCUMENTOS_CHAT));
  }

  alCambiarUsoDocumentos(evento: Event): void {
    this.usarDocumentos.set((evento.target as HTMLInputElement).checked);
  }

  puedeEnviar(): boolean {
    return this.mensajeControl.value.trim().length > 0 && !this.enviando();
  }

  esAsistente(mensaje: MensajeVista): boolean {
    return mensaje.rol_mensaje === 'assistant';
  }

  etiquetaReferencia(referencia: ReferenciaRespuesta): string {
    const nombre = referencia.documento_nombre ?? 'Documento';
    return referencia.numero_pagina ? `${nombre} · pág. ${referencia.numero_pagina}` : nombre;
  }
}
