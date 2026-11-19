import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export const ESTADOS_TARJETA = ['sin_revisar', 'conocida', 'repaso'] as const;

export type EstadoTarjeta = (typeof ESTADOS_TARJETA)[number];

export type FiltroTarjetas = 'todas' | 'pendientes';

export const CANTIDAD_MINIMA_TARJETAS = 5;
export const CANTIDAD_MAXIMA_TARJETAS = 30;
export const CANTIDAD_TARJETAS_POR_DEFECTO = 10;
export const LIMITE_CONJUNTOS_POR_PAGINA = 20;

export interface Tarjeta {
  id: string;
  conjunto_id: string;
  orden: number;
  frente: string;
  reverso: string;
  estado: EstadoTarjeta;
  fecha_actualizacion: string;
}

export interface ConjuntoTarjetasResumen {
  id: string;
  usuario_id: string;
  materia_id: string;
  materia_nombre: string | null;
  documento_id: string | null;
  titulo: string;
  cantidad_tarjetas: number;
  cantidad_conocidas: number;
  cantidad_pendientes: number;
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  fecha_creacion: string;
}

export interface ConjuntoTarjetasGenerado extends ConjuntoTarjetasResumen {
  tarjetas: Tarjeta[];
}

export interface ConjuntoTarjetasDetalle extends ConjuntoTarjetasResumen {
  tarjetas: Tarjeta[];
}

export interface ConjuntoListado {
  conjuntos: ConjuntoTarjetasResumen[];
  total: number;
}

export interface SolicitudTarjetas {
  materia_id: string;
  documento_id?: string | null;
  cantidad_tarjetas: number;
}

export interface PaginacionConjuntos {
  limit: number;
  offset: number;
}

/**
 * Servicio HTTP de tarjetas de memoria (HU14).
 * Genera conjuntos, consulta el historial y registra el avance de estudio.
 */
@Injectable({ providedIn: 'root' })
export class TarjetaService {
  private readonly api = inject(ApiService);

  generar(solicitud: SolicitudTarjetas): Observable<ConjuntoTarjetasGenerado> {
    return this.api.post<ConjuntoTarjetasGenerado>('/asistente/tarjetas', solicitud);
  }

  listar({ limit, offset }: PaginacionConjuntos): Observable<ConjuntoListado> {
    return this.api
      .getWithMeta<ConjuntoTarjetasResumen[], { total: number }>('/asistente/tarjetas/conjuntos', {
        limit,
        offset,
      })
      .pipe(
        map(({ data, meta }) => ({
          conjuntos: data ?? [],
          total: meta.total ?? 0,
        })),
      );
  }

  obtener(id: string, filtro: FiltroTarjetas = 'todas'): Observable<ConjuntoTarjetasDetalle> {
    return this.api.get<ConjuntoTarjetasDetalle>(
      `/asistente/tarjetas/conjuntos/${encodeURIComponent(id)}`,
      { estado: filtro },
    );
  }

  eliminar(id: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(
      `/asistente/tarjetas/conjuntos/${encodeURIComponent(id)}`,
    );
  }

  actualizarEstado(tarjetaId: string, estado: EstadoTarjeta): Observable<Tarjeta> {
    return this.api.patch<Tarjeta>(`/asistente/tarjetas/${encodeURIComponent(tarjetaId)}/estado`, {
      estado,
    });
  }

  etiquetaEstado(estado: EstadoTarjeta): string {
    const etiquetas: Record<EstadoTarjeta, string> = {
      sin_revisar: 'Sin revisar',
      conocida: 'Conocida',
      repaso: 'Para repaso',
    };

    return etiquetas[estado];
  }

  claseEstado(estado: EstadoTarjeta): string {
    const clases: Record<EstadoTarjeta, string> = {
      sin_revisar: 'text-bg-light border',
      conocida: 'text-bg-success',
      repaso: 'text-bg-warning',
    };

    return clases[estado];
  }
}
