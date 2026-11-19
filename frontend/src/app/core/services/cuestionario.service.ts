import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export const TIPOS_PREGUNTA_CUESTIONARIO = [
  'opcion_multiple',
  'verdadero_falso',
  'abierta',
] as const;

export type TipoPreguntaCuestionario = (typeof TIPOS_PREGUNTA_CUESTIONARIO)[number];

export const DIFICULTADES_CUESTIONARIO = ['basica', 'intermedia', 'avanzada'] as const;

export type DificultadCuestionario = (typeof DIFICULTADES_CUESTIONARIO)[number];

export const ESTADOS_INTENTO = ['en_progreso', 'finalizado'] as const;

export type EstadoIntento = (typeof ESTADOS_INTENTO)[number];

export interface CuestionarioResumen {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  materia_nombre: string | null;
  documento_id: string | null;
  titulo: string;
  dificultad: DificultadCuestionario;
  cantidad_preguntas: number;
  tipos: TipoPreguntaCuestionario[];
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  fecha_creacion: string;
}

export interface OpcionCuestionario {
  id: string;
  contenido: string;
  orden: number;
  es_correcta?: boolean;
}

export interface PreguntaCuestionario {
  id: string;
  cuestionario_id: string;
  orden: number;
  enunciado: string;
  tipo_pregunta: TipoPreguntaCuestionario;
  opciones: OpcionCuestionario[];
  respuesta_usuario: string | null;
  es_correcta: boolean | null;
  respuesta_correcta?: string | null;
  explicacion?: string | null;
}

export interface IntentoCuestionarioResumen {
  id: string;
  cuestionario_id: string;
  estado: EstadoIntento;
  total_preguntas: number;
  preguntas_objetivas: number;
  respuestas_correctas: number;
  puntuacion: number | null;
  fecha_inicio: string;
  fecha_finalizacion: string | null;
}

export interface CuestionarioGenerado extends CuestionarioResumen {
  preguntas: PreguntaCuestionario[];
}

export interface CuestionarioDetalle extends CuestionarioResumen {
  preguntas: PreguntaCuestionario[];
  intentos: IntentoCuestionarioResumen[];
}

export interface CuestionarioListado {
  cuestionarios: CuestionarioResumen[];
  total: number;
}

export interface IntentoIniciado {
  intento: IntentoCuestionarioResumen;
  cuestionario: CuestionarioGenerado;
}

export interface ResultadoIntento {
  intento: IntentoCuestionarioResumen;
  cuestionario: CuestionarioResumen;
  preguntas: PreguntaCuestionario[];
}

export interface SolicitudCuestionario {
  materia_id: string;
  documento_id?: string | null;
  cantidad_preguntas: number;
  dificultad: DificultadCuestionario;
  tipos: TipoPreguntaCuestionario[];
}

export interface RespuestaPregunta {
  pregunta_id: string;
  respuesta: string;
}

export interface PaginacionCuestionarios {
  limit: number;
  offset: number;
}

/**
 * Servicio HTTP de cuestionarios academicos (HU13).
 * Genera, lista, resuelve y elimina cuestionarios del usuario autenticado.
 */
@Injectable({ providedIn: 'root' })
export class CuestionarioService {
  private readonly api = inject(ApiService);

  generar(solicitud: SolicitudCuestionario): Observable<CuestionarioGenerado> {
    return this.api.post<CuestionarioGenerado>('/asistente/cuestionario', solicitud);
  }

  listar({ limit, offset }: PaginacionCuestionarios): Observable<CuestionarioListado> {
    return this.api
      .getWithMeta<CuestionarioResumen[], { total: number }>('/asistente/cuestionarios', {
        limit,
        offset,
      })
      .pipe(
        map(({ data, meta }) => ({
          cuestionarios: data ?? [],
          total: meta.total ?? 0,
        })),
      );
  }

  obtener(id: string): Observable<CuestionarioDetalle> {
    return this.api.get<CuestionarioDetalle>(
      `/asistente/cuestionarios/${encodeURIComponent(id)}`,
    );
  }

  eliminar(id: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(
      `/asistente/cuestionarios/${encodeURIComponent(id)}`,
    );
  }

  iniciarIntento(cuestionarioId: string): Observable<IntentoIniciado> {
    return this.api.post<IntentoIniciado>(
      `/asistente/cuestionarios/${encodeURIComponent(cuestionarioId)}/intentos`,
    );
  }

  responder(intentoId: string, respuestas: RespuestaPregunta[]): Observable<ResultadoIntento> {
    return this.api.post<ResultadoIntento>(
      `/asistente/intentos/${encodeURIComponent(intentoId)}/responder`,
      { respuestas },
    );
  }

  obtenerIntento(intentoId: string): Observable<ResultadoIntento> {
    return this.api.get<ResultadoIntento>(
      `/asistente/intentos/${encodeURIComponent(intentoId)}`,
    );
  }

  etiquetaTipo(tipo: TipoPreguntaCuestionario): string {
    const etiquetas: Record<TipoPreguntaCuestionario, string> = {
      opcion_multiple: 'Opción múltiple',
      verdadero_falso: 'Verdadero o falso',
      abierta: 'Respuesta abierta',
    };

    return etiquetas[tipo];
  }

  etiquetaDificultad(dificultad: DificultadCuestionario): string {
    const etiquetas: Record<DificultadCuestionario, string> = {
      basica: 'Básica',
      intermedia: 'Intermedia',
      avanzada: 'Avanzada',
    };

    return etiquetas[dificultad];
  }
}
