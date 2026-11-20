import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  type PlanEstudio,
  type PlanEstudioDetalle,
  type PropuestaPlan,
  type SesionEstudio,
  type SolicitudPlan,
} from '../models/plan-estudio.model';

export interface PaginacionPlanes {
  limit: number;
  offset: number;
}

export interface PlanesListado {
  planes: PlanEstudio[];
  total: number;
}

export interface ConfirmarPlanInput extends SolicitudPlan {
  modelo?: string;
  tokens_entrada: number;
  tokens_salida: number;
  sesiones: Array<{
    tema: string;
    actividades: string;
    fecha_inicio: string;
    duracion_minutos: number;
    tipo?: string;
  }>;
}

export interface SesionInput {
  sesion: {
    tema: string;
    actividades: string;
    fecha_inicio: string;
    duracion_minutos: number;
    tipo?: string;
  };
}

export interface CambiosSesion {
  tema?: string;
  actividades?: string;
  fecha_inicio?: string;
  duracion_minutos?: number;
  tipo?: string;
  estado?: 'pendiente' | 'completada';
}

/**
 * Servicio HTTP de planes de estudio (HU15).
 * Genera propuestas sin guardar y persiste solo el plan confirmado.
 */
@Injectable({ providedIn: 'root' })
export class PlanEstudioService {
  private readonly api = inject(ApiService);

  proponer(solicitud: SolicitudPlan): Observable<PropuestaPlan> {
    return this.api.post<PropuestaPlan>('/asistente/plan', solicitud);
  }

  confirmar(entrada: ConfirmarPlanInput): Observable<PlanEstudioDetalle> {
    return this.api.post<PlanEstudioDetalle>('/estudio/planes', entrada);
  }

  listar({ limit, offset }: PaginacionPlanes): Observable<PlanesListado> {
    return this.api
      .getWithMeta<PlanEstudio[], { total: number }>('/estudio/planes', { limit, offset })
      .pipe(
        map(({ data, meta }) => ({
          planes: data ?? [],
          total: meta.total ?? 0,
        })),
      );
  }

  obtener(planId: string): Observable<PlanEstudioDetalle> {
    return this.api.get<PlanEstudioDetalle>(`/estudio/planes/${encodeURIComponent(planId)}`);
  }

  actualizar(
    planId: string,
    cambios: {
      objetivo?: string;
      fecha_examen?: string;
      minutos_por_dia?: number;
      dias_disponibles?: string[];
    },
  ): Observable<PlanEstudio> {
    return this.api.put<PlanEstudio>(
      `/estudio/planes/${encodeURIComponent(planId)}`,
      cambios,
    );
  }

  descartar(planId: string): Observable<{ id: string; estado: string }> {
    return this.api.delete<{ id: string; estado: string }>(
      `/estudio/planes/${encodeURIComponent(planId)}`,
    );
  }

  agregarSesion(planId: string, sesion: SesionInput['sesion']): Observable<SesionEstudio> {
    return this.api.post<SesionEstudio>(
      `/estudio/planes/${encodeURIComponent(planId)}/sesiones`,
      { sesion },
    );
  }

  actualizarSesion(sesionId: string, cambios: CambiosSesion): Observable<SesionEstudio> {
    return this.api.patch<SesionEstudio>(
      `/estudio/sesiones/${encodeURIComponent(sesionId)}`,
      cambios,
    );
  }

  eliminarSesion(sesionId: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(`/estudio/sesiones/${encodeURIComponent(sesionId)}`);
  }
}
