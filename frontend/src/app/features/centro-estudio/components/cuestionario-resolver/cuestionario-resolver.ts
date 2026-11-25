import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  CuestionarioService,
  type IntentoCuestionarioResumen,
  type PreguntaCuestionario,
  type ResultadoIntento,
} from '../../../../core/services/cuestionario.service';
import { mensajeDeErrorHttp } from '../../../../core/utils/http-error';
import { valorDeCampo } from '../../../../core/utils/form-event';
import { MascotaAgenteComponent } from '../../../../shared/components/mascota-agente/mascota-agente.component';
import { crearEstadoMascota } from '../../../../shared/components/mascota-agente/estado-mascota';

@Component({
  selector: 'app-cuestionario-resolver',
  imports: [MascotaAgenteComponent],
  templateUrl: './cuestionario-resolver.html',
  styleUrl: './cuestionario-resolver.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuestionarioResolverComponent implements OnInit {
  private readonly cuestionarioService = inject(CuestionarioService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cuestionarioId = input.required<string>();
  readonly titulo = input('Cuestionario');
  /** Si se indica, se muestra un intento finalizado en lugar de iniciar uno nuevo. */
  readonly intentoId = input<string | null>(null);

  readonly volver = output<void>();
  readonly completado = output<void>();

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  private readonly controlMascota = crearEstadoMascota(this.enviando, this.destroyRef);
  readonly estadoMascota = this.controlMascota.estado;
  readonly error = signal<string | null>(null);
  readonly intento = signal<IntentoCuestionarioResumen | null>(null);
  readonly preguntas = signal<PreguntaCuestionario[]>([]);
  readonly respuestas = signal<Record<string, string>>({});
  readonly valorCampo = valorDeCampo;
  readonly resultado = signal<ResultadoIntento | null>(null);

  readonly hayResultado = computed(() => this.resultado() !== null);
  readonly esRevision = computed(() => this.intentoId() !== null);
  readonly retroalimentacionGeneral = computed(
    () => this.resultado()?.intento.retroalimentacion_general ?? null,
  );
  readonly avisoEvaluacion = computed(() => this.resultado()?.aviso_evaluacion ?? null);
  readonly recomendaciones = computed(() => this.resultado()?.intento.recomendaciones ?? []);
  readonly dominioPorTema = computed(() => this.resultado()?.intento.dominio_por_tema ?? []);
  readonly evaluacionesAbiertas = computed(() =>
    (this.resultado()?.preguntas ?? []).filter(
      (pregunta) => pregunta.tipo_pregunta === 'abierta' && pregunta.evaluacion,
    ),
  );

  readonly respondidas = computed(
    () =>
      this.preguntas().filter((pregunta) => (this.respuestas()[pregunta.id] ?? '').trim().length > 0)
        .length,
  );

  readonly todasRespondidas = computed(
    () => this.preguntas().length > 0 && this.respondidas() === this.preguntas().length,
  );

  readonly porcentajeAvance = computed(() => {
    const total = this.preguntas().length;
    return total === 0 ? 0 : Math.round((this.respondidas() / total) * 100);
  });

  readonly puntuacion = computed(() => this.resultado()?.intento.puntuacion ?? null);

  readonly cantidadCalificadas = computed(
    () =>
      (this.resultado()?.preguntas ?? []).filter(
        (pregunta) => pregunta.tipo_pregunta !== 'abierta' || pregunta.evaluacion,
      ).length,
  );

  readonly mensajeResultado = computed(() => {
    const resultado = this.resultado();
    if (!resultado) {
      return '';
    }

    if (resultado.intento.puntuacion === null) {
      return 'Tus respuestas quedaron registradas, pero no hay suficiente información para calcular una nota.';
    }

    return `Acertaste ${resultado.intento.respuestas_correctas} de ${this.cantidadCalificadas()} preguntas calificadas.`;
  });

  ngOnInit(): void {
    if (this.esRevision()) {
      this.cargarRevision();
      return;
    }

    this.iniciar();
  }

  iniciar(): void {
    this.cargando.set(true);
    this.error.set(null);

    this.cuestionarioService
      .iniciarIntento(this.cuestionarioId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ intento, cuestionario }) => {
          this.intento.set(intento);
          this.preguntas.set(cuestionario.preguntas);
          this.respuestas.set({});
          this.resultado.set(null);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudo iniciar el cuestionario. Inténtalo de nuevo.'),
          );
          this.cargando.set(false);
        },
      });
  }

  cargarRevision(): void {
    const intentoId = this.intentoId();
    if (!intentoId) {
      return;
    }

    this.cargando.set(true);
    this.error.set(null);

    this.cuestionarioService
      .obtenerIntento(intentoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.resultado.set(resultado);
          this.intento.set(resultado.intento);
          this.preguntas.set(resultado.preguntas);
          this.cargando.set(false);
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudo cargar la evaluación. Inténtalo de nuevo.'),
          );
          this.cargando.set(false);
        },
      });
  }

  seleccionar(preguntaId: string, valor: string): void {
    if (this.hayResultado()) {
      return;
    }

    this.respuestas.update((respuestas) => ({ ...respuestas, [preguntaId]: valor }));
  }

  valor(preguntaId: string): string {
    return this.respuestas()[preguntaId] ?? '';
  }

  enviar(): void {
    const intento = this.intento();

    if (!intento || !this.todasRespondidas() || this.enviando() || this.hayResultado()) {
      return;
    }

    this.enviando.set(true);
    this.error.set(null);
    this.controlMascota.reiniciar();

    const respuestas = this.preguntas().map((pregunta) => ({
      pregunta_id: pregunta.id,
      respuesta: this.valor(pregunta.id).trim(),
    }));

    this.cuestionarioService
      .responder(intento.id, respuestas)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (resultado) => {
          this.resultado.set(resultado);
          this.preguntas.set(resultado.preguntas);
          this.enviando.set(false);
          this.controlMascota.anunciarResultado();
          this.completado.emit();
        },
        error: (error: unknown) => {
          this.error.set(
            mensajeDeErrorHttp(error, 'No se pudieron registrar tus respuestas. Inténtalo de nuevo.'),
          );
          this.enviando.set(false);
        },
      });
  }

  esCorrecta(pregunta: PreguntaCuestionario): boolean | null {
    return pregunta.evaluacion?.es_correcta ?? pregunta.es_correcta;
  }

  iconoResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta' && !pregunta.evaluacion) {
      return 'bi-hourglass-split';
    }

    return this.esCorrecta(pregunta) ? 'bi-check-circle' : 'bi-x-circle';
  }

  claseResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta' && !pregunta.evaluacion) {
      return 'text-secondary';
    }

    return this.esCorrecta(pregunta) ? 'text-success' : 'text-danger';
  }

  textoResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta' && !pregunta.evaluacion) {
      return 'Pendiente de evaluación';
    }

    if (pregunta.evaluacion) {
      return `Evaluada · ${pregunta.evaluacion.puntaje}/10`;
    }

    return pregunta.es_correcta ? 'Correcta' : 'Incorrecta';
  }

  etiquetaCriterio(nombre: string): string {
    const etiquetas: Record<string, string> = {
      precision_conceptual: 'Precisión conceptual',
      completitud: 'Completitud',
      claridad: 'Claridad',
    };

    return etiquetas[nombre] ?? nombre;
  }
}
