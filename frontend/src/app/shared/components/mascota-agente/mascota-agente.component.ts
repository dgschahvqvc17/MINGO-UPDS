import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, share, throttleTime } from 'rxjs';

/** Estados visibles del agente. Se derivan del ciclo real de cada petición de IA. */
export type EstadoMascota = 'inactivo' | 'pensando' | 'hablando' | 'durmiendo';

const MOVIMIENTO_MAXIMO = 12;
const GIRO_MAXIMO = 8;
const MIRADA_MAXIMA = 6;
const GIRO_CABEZA_MAXIMO = 5;
const INCLINACION_CABEZA_MAXIMA = 3;
const INTERVALO_SEGUIMIENTO = 16;
const DURACION_SALUDO = 3200;
const RETARDO_HABLA = 500;

let siguienteInstancia = 0;

/** Un único listener de cursor para todas las mascotas de la página. */
const MOVIMIENTO_CURSOR =
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? fromEvent<MouseEvent>(window, 'mousemove').pipe(
        throttleTime(INTERVALO_SEGUIMIENTO),
        share(),
      )
    : null;

/**
 * Cara del asistente MINGO: un cachorro con audífonos que flota en reposo,
 * inclina la cabeza al pensar y mueve la boca al responder. Es presentacional:
 * recibe el estado por input y no llama a la API de IA.
 */
@Component({
  selector: 'app-mascota-agente',
  templateUrl: './mascota-agente.component.html',
  styleUrl: './mascota-agente.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.mascota--compacta]': 'compacta()',
    '[class.mascota--grande]': 'grande()',
  },
})
export class MascotaAgenteComponent implements OnInit {
  readonly estado = input<EstadoMascota>('inactivo');
  readonly compacta = input(false);
  readonly grande = input(false);
  readonly soloCabeza = input(false);
  readonly saludar = input(false);
  readonly mensaje = input('');
  readonly mostrarMensaje = input(false);
  readonly seguirCursor = input(true);
  readonly seguimientoCabeza = input(false);
  readonly hablaAlSaludar = input(false);

  /** Prefijo único para los degradados: permite varias mascotas en una misma página. */
  readonly prefijo = `mascota-${siguienteInstancia++}`;
  readonly desplazamiento = signal('');
  readonly mirada = signal('');
  readonly cabeza = signal('');
  readonly saludando = signal(false);
  private readonly estadoTemporal = signal<EstadoMascota | null>(null);
  private readonly temporizadores: ReturnType<typeof setTimeout>[] = [];

  readonly estadoVisible = computed<EstadoMascota>(
    () => this.estadoTemporal() ?? this.estado(),
  );

  readonly etiquetaAccesible = computed(() => {
    const etiquetas: Record<EstadoMascota, string> = {
      inactivo: 'Mascota del asistente MINGO en reposo',
      pensando: 'Mascota del asistente MINGO pensando',
      hablando: 'Mascota del asistente MINGO hablando',
      durmiendo: 'Mascota del asistente MINGO dormida',
    };

    const estado = etiquetas[this.estadoVisible()];
    return this.saludando() ? `${estado} y saludando` : estado;
  });

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly movimientoReducido =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  ngOnInit(): void {
    if (!this.saludar() || this.movimientoReducido) {
      return;
    }

    this.saludando.set(true);

    if (this.hablaAlSaludar()) {
      this.estadoTemporal.set('pensando');
      this.programar(() => this.estadoTemporal.set('hablando'), RETARDO_HABLA);
    }

    this.programar(() => {
      this.saludando.set(false);
      this.estadoTemporal.set(null);
    }, DURACION_SALUDO);

    this.destroyRef.onDestroy(() => this.temporizadores.forEach(clearTimeout));
  }

  private programar(tarea: () => void, demora: number): void {
    this.temporizadores.push(setTimeout(tarea, demora));
  }

  constructor() {
    if (this.movimientoReducido || !MOVIMIENTO_CURSOR) {
      return;
    }

    MOVIMIENTO_CURSOR.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) =>
      this.actualizarSeguimiento(evento),
    );
  }

  private actualizarSeguimiento(evento: MouseEvent): void {
    if (!this.seguirCursor()) {
      return;
    }

    const rect = this.elemento.nativeElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      return;
    }

    const centroX = rect.left + rect.width / 2;
    const centroY = rect.top + rect.height / 2;
    const deltaX = (evento.clientX - centroX) / (window.innerWidth / 2);
    const deltaY = (evento.clientY - centroY) / (window.innerHeight / 2);

    const desplazamientoX = this.limitar(deltaX * MOVIMIENTO_MAXIMO, MOVIMIENTO_MAXIMO);
    const desplazamientoY = this.limitar(deltaY * (MOVIMIENTO_MAXIMO - 2), MOVIMIENTO_MAXIMO - 2);
    const giro = this.limitar(deltaX * GIRO_MAXIMO, GIRO_MAXIMO);
    const miradaX = this.limitar(deltaX * MIRADA_MAXIMA, MIRADA_MAXIMA);
    const miradaY = this.limitar(deltaY * MIRADA_MAXIMA, MIRADA_MAXIMA);

    this.desplazamiento.set(
      `translate(${desplazamientoX.toFixed(1)}px, ${desplazamientoY.toFixed(1)}px) rotate(${giro.toFixed(1)}deg)`,
    );
    this.mirada.set(`translate(${miradaX.toFixed(1)}px, ${miradaY.toFixed(1)}px)`);

    if (this.seguimientoCabeza()) {
      const giro = this.limitar(deltaX * GIRO_CABEZA_MAXIMO, GIRO_CABEZA_MAXIMO);
      const inclinacion = this.limitar(
        deltaY * INCLINACION_CABEZA_MAXIMA,
        INCLINACION_CABEZA_MAXIMA,
      );
      this.cabeza.set(`rotate(${giro.toFixed(1)}deg) translateY(${inclinacion.toFixed(1)}px)`);
    }
  }

  private limitar(valor: number, limite: number): number {
    return Math.max(-limite, Math.min(limite, valor));
  }
}
