import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { fromEvent, merge, throttleTime } from 'rxjs';
import {
  MascotaAgenteComponent,
  type EstadoMascota,
} from '../mascota-agente/mascota-agente.component';

const RUTA_ASISTENTE = '/asistente-ia';
const MENSAJE_BASE = '¿En qué puedo ayudarte?';
const MENSAJE_DORMIDO = 'Zzz…';
const MENSAJE_DESPIERTO = '¡Hola! ¿En qué puedo ayudarte?';
const MENSAJE_SORPRESA = '¡Sorpresa! ¿Qué quieres preguntarme?';
const MENSAJE_ABRIENDO = '¡Vamos allá!';

const TIEMPO_INACTIVIDAD = 12000;
const TIEMPO_DORMIDO = 6000;
const DURACION_SORPRESA = 2600;
const DURACION_DESPIERTO = 1800;
const INTERVALO_ACTIVIDAD = 1000;

/** Acceso rápido al asistente: mascota flotante disponible en todas las pantallas del shell. */
@Component({
  selector: 'app-ayudante-flotante',
  imports: [MascotaAgenteComponent],
  templateUrl: './ayudante-flotante.component.html',
  styleUrl: './ayudante-flotante.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AyudanteFlotanteComponent {
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly temporizadores: ReturnType<typeof setTimeout>[] = [];
  private destruido = false;

  readonly estado = signal<EstadoMascota>('inactivo');
  readonly mensaje = signal(MENSAJE_BASE);

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.destruido = true;
      this.limpiarTemporizadores();
    });

    if (typeof window !== 'undefined') {
      merge(
        fromEvent<Event>(window, 'mousemove'),
        fromEvent<Event>(window, 'keydown'),
        fromEvent<Event>(window, 'pointerdown'),
      )
        .pipe(throttleTime(INTERVALO_ACTIVIDAD), takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.reaccionarActividad());
    }

    this.programarReposo();
  }

  despertar(): void {
    if (this.estado() === 'hablando' || this.destruido) {
      return;
    }

    this.limpiarTemporizadores();
    this.estado.set('hablando');
    this.mensaje.set(MENSAJE_DESPIERTO);
    this.programar(() => this.volverAlReposo(), DURACION_DESPIERTO);
  }

  abrirAsistente(): void {
    if (this.destruido) {
      return;
    }

    this.limpiarTemporizadores();
    this.estado.set('pensando');
    this.mensaje.set(MENSAJE_ABRIENDO);

    void this.router.navigate([RUTA_ASISTENTE]).finally(() => {
      if (!this.destruido) {
        this.volverAlReposo();
      }
    });
  }

  private reaccionarActividad(): void {
    if (this.destruido) {
      return;
    }

    if (this.estado() === 'durmiendo') {
      this.despertar();
      return;
    }

    if (this.estado() === 'inactivo') {
      this.programarReposo();
    }
  }

  private programarReposo(): void {
    this.limpiarTemporizadores();
    this.programar(() => this.dormirse(), TIEMPO_INACTIVIDAD);
  }

  private dormirse(): void {
    this.estado.set('durmiendo');
    this.mensaje.set(MENSAJE_DORMIDO);
    this.programar(() => this.sorprender(), TIEMPO_DORMIDO);
  }

  private sorprender(): void {
    this.estado.set('hablando');
    this.mensaje.set(MENSAJE_SORPRESA);
    this.programar(() => this.volverAlReposo(), DURACION_SORPRESA);
  }

  private volverAlReposo(): void {
    this.estado.set('inactivo');
    this.mensaje.set(MENSAJE_BASE);
    this.programarReposo();
  }

  private programar(tarea: () => void, demora: number): void {
    this.temporizadores.push(
      setTimeout(() => {
        if (!this.destruido) {
          tarea();
        }
      }, demora),
    );
  }

  private limpiarTemporizadores(): void {
    this.temporizadores.forEach(clearTimeout);
    this.temporizadores.length = 0;
  }
}
