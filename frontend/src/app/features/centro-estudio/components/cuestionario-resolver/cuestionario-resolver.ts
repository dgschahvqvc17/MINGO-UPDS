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

@Component({
  selector: 'app-cuestionario-resolver',
  templateUrl: './cuestionario-resolver.html',
  styleUrl: './cuestionario-resolver.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CuestionarioResolverComponent implements OnInit {
  private readonly cuestionarioService = inject(CuestionarioService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cuestionarioId = input.required<string>();
  readonly titulo = input('Cuestionario');

  readonly volver = output<void>();
  readonly completado = output<void>();

  readonly cargando = signal(true);
  readonly enviando = signal(false);
  readonly error = signal<string | null>(null);
  readonly intento = signal<IntentoCuestionarioResumen | null>(null);
  readonly preguntas = signal<PreguntaCuestionario[]>([]);
  readonly respuestas = signal<Record<string, string>>({});
  readonly resultado = signal<ResultadoIntento | null>(null);

  readonly hayResultado = computed(() => this.resultado() !== null);

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

  readonly mensajeResultado = computed(() => {
    const resultado = this.resultado();
    if (!resultado) {
      return '';
    }

    const { puntuacion, respuestas_correctas, preguntas_objetivas } = resultado.intento;

    if (puntuacion === null) {
      return 'Tus respuestas abiertas quedaron registradas para una evaluación posterior.';
    }

    return `Acertaste ${respuestas_correctas} de ${preguntas_objetivas} preguntas objetivas.`;
  });

  ngOnInit(): void {
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
    return pregunta.es_correcta;
  }

  iconoResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta') {
      return 'bi-hourglass-split';
    }

    return pregunta.es_correcta ? 'bi-check-circle' : 'bi-x-circle';
  }

  claseResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta') {
      return 'text-secondary';
    }

    return pregunta.es_correcta ? 'text-success' : 'text-danger';
  }

  textoResultado(pregunta: PreguntaCuestionario): string {
    if (pregunta.tipo_pregunta === 'abierta') {
      return 'Pendiente de evaluación';
    }

    return pregunta.es_correcta ? 'Correcta' : 'Incorrecta';
  }
}
