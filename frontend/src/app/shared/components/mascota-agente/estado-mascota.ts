import type { DestroyRef, Signal } from '@angular/core';
import { computed, signal } from '@angular/core';
import type { EstadoMascota } from './mascota-agente.component';

/** La fase "hablando" es breve: el agente habla y vuelve a reposo por si solo. */
const DURACION_HABLANDO = 2400;

export interface ControlEstadoMascota {
  readonly estado: Signal<EstadoMascota>;
  anunciarResultado(): void;
  reiniciar(): void;
}

/**
 * Deriva el estado de la mascota de una señal de carga real y anuncia cada
 * resultado con una fase "hablando" temporal. El temporizador se cancela al
 * destruir el componente o al iniciar una nueva petición.
 */
export function crearEstadoMascota(
  cargando: Signal<boolean>,
  destroyRef: DestroyRef,
): ControlEstadoMascota {
  const hablando = signal(false);
  let temporizador: ReturnType<typeof setTimeout> | null = null;

  const detener = (): void => {
    if (temporizador !== null) {
      clearTimeout(temporizador);
      temporizador = null;
    }
    hablando.set(false);
  };

  destroyRef.onDestroy(detener);

  const estado = computed<EstadoMascota>(() => {
    if (cargando()) {
      return 'pensando';
    }

    return hablando() ? 'hablando' : 'inactivo';
  });

  return {
    estado,
    anunciarResultado(): void {
      detener();
      hablando.set(true);
      temporizador = setTimeout(() => {
        hablando.set(false);
        temporizador = null;
      }, DURACION_HABLANDO);
    },
    reiniciar: detener,
  };
}
