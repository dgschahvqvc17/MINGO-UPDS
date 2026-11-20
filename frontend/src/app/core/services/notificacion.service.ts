import { Injectable, inject, signal } from '@angular/core';
import { Observable, map } from 'rxjs';
import {
  Notificacion,
  PreferenciasNotificacion,
  TipoNotificacion,
} from '../models/dominio.models';
import { ApiService } from './api.service';

export interface FiltroNotificaciones {
  leida?: boolean;
  tipo?: TipoNotificacion;
  page: number;
  limit: number;
}

export interface MetaNotificaciones {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ListadoNotificaciones {
  items: Notificacion[];
  meta: MetaNotificaciones;
}

export type CambiosPreferenciasNotificacion = Partial<
  Pick<
    PreferenciasNotificacion,
    'notificaciones_activas' | 'anticipacion_minutos' | 'canal_email' | 'zona_horaria' | 'idioma'
  >
>;

/**
 * Servicio de notificaciones (HU18). Centraliza el contador de no leídas para
 * que el shell y la página compartan el mismo estado sin duplicar peticiones.
 */
@Injectable({ providedIn: 'root' })
export class NotificacionService {
  private readonly api = inject(ApiService);
  private readonly contadorSignal = signal(0);

  readonly noLeidas = this.contadorSignal.asReadonly();

  listar(filtro: FiltroNotificaciones): Observable<ListadoNotificaciones> {
    return this.api
      .getWithMeta<Notificacion[], MetaNotificaciones>('/notificaciones', {
        ...(filtro.leida === undefined ? {} : { leida: filtro.leida }),
        ...(filtro.tipo ? { tipo: filtro.tipo } : {}),
        page: filtro.page,
        limit: filtro.limit,
      })
      .pipe(
        map(({ data, meta }) => {
          if (filtro.leida === false) {
            this.contadorSignal.set(meta.total);
          }

          return { items: data, meta };
        }),
      );
  }

  contarNoLeidas(): Observable<number> {
    return this.listar({ leida: false, page: 1, limit: 1 }).pipe(
      map(({ meta }) => meta.total),
    );
  }

  marcarLeida(id: string): Observable<Notificacion> {
    return this.api
      .patch<Notificacion>(`/notificaciones/${encodeURIComponent(id)}/leida`)
      .pipe(
        map((notificacion) => {
          this.contadorSignal.update((total) => Math.max(0, total - 1));
          return notificacion;
        }),
      );
  }

  marcarTodasLeidas(): Observable<{ actualizadas: number }> {
    return this.api.patch<{ actualizadas: number }>('/notificaciones/leer-todas').pipe(
      map((resultado) => {
        this.contadorSignal.set(0);
        return resultado;
      }),
    );
  }

  obtenerPreferencias(): Observable<PreferenciasNotificacion> {
    return this.api.get<PreferenciasNotificacion>('/notificaciones/preferencias');
  }

  actualizarPreferencias(
    cambios: CambiosPreferenciasNotificacion,
  ): Observable<PreferenciasNotificacion> {
    return this.api.put<PreferenciasNotificacion>('/notificaciones/preferencias', cambios);
  }
}
