import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { fromEvent, share, throttleTime } from 'rxjs';

/** Estados visibles del agente. Se derivan del ciclo real de cada petición de IA. */
export type EstadoMascota = 'inactivo' | 'pensando' | 'hablando';

const MOVIMIENTO_MAXIMO = 12;
const GIRO_MAXIMO = 8;
const INTERVALO_SEGUIMIENTO = 16;

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
  },
})
export class MascotaAgenteComponent {
  readonly estado = input<EstadoMascota>('inactivo');
  readonly compacta = input(false);

  /** Prefijo único para los degradados: permite varias mascotas en una misma página. */
  readonly prefijo = `mascota-${siguienteInstancia++}`;
  readonly desplazamiento = signal('');

  readonly etiquetaAccesible = computed(() => {
    const etiquetas: Record<EstadoMascota, string> = {
      inactivo: 'Mascota del asistente MINGO en reposo',
      pensando: 'Mascota del asistente MINGO pensando',
      hablando: 'Mascota del asistente MINGO hablando',
    };

    return etiquetas[this.estado()];
  });

  private readonly elemento = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly movimientoReducido =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor() {
    if (this.movimientoReducido || !MOVIMIENTO_CURSOR) {
      return;
    }

    MOVIMIENTO_CURSOR.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((evento) =>
      this.seguirCursor(evento),
    );
  }

  private seguirCursor(evento: MouseEvent): void {
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

    this.desplazamiento.set(
      `translate(${desplazamientoX.toFixed(1)}px, ${desplazamientoY.toFixed(1)}px) rotate(${giro.toFixed(1)}deg)`,
    );
  }

  private limitar(valor: number, limite: number): number {
    return Math.max(-limite, Math.min(limite, valor));
  }
}
