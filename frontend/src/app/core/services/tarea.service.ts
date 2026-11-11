import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export const TIPOS_TAREA = [
  'tarea',
  'taller',
  'parcial',
  'examen',
  'proyecto',
  'exposicion',
  'laboratorio',
  'practica',
  'otro',
] as const;

export const ESTADOS_TAREA = ['pendiente', 'en_progreso', 'completada'] as const;
export const PRIORIDADES_TAREA = ['baja', 'media', 'alta'] as const;

export type TipoTarea = (typeof TIPOS_TAREA)[number];
export type EstadoTarea = (typeof ESTADOS_TAREA)[number];
export type PrioridadTarea = (typeof PRIORIDADES_TAREA)[number];

export interface MateriaResumenTarea {
  nombre: string;
  codigo: string;
  color: string;
}

export interface Tarea {
  id: string;
  usuario_id: string;
  materia_id: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoTarea;
  prioridad: PrioridadTarea;
  fecha_asignacion: string;
  fecha_entrega: string | null;
  estado: EstadoTarea;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  materias?: MateriaResumenTarea | MateriaResumenTarea[] | null;
}

export interface Paginacion {
  limit: number;
  offset: number;
  total: number;
}

export interface TareaListado {
  tareas: Tarea[];
  paginacion: Paginacion;
}

export interface RangoProximas {
  dias: number;
  desde: string;
  hasta: string;
}

export interface TareasProximas {
  tareas: Tarea[];
  rango: RangoProximas;
}

export interface TareaEstadisticas {
  total: number;
  pendientes: number;
  en_progreso: number;
  completadas: number;
  vencidas: number;
  prioridad_alta: number;
  prioridad_media: number;
  prioridad_baja: number;
}

export type TareaFiltros = {
  materia_id?: string;
  estado?: EstadoTarea;
  prioridad?: PrioridadTarea;
  tipo?: TipoTarea;
  query?: string;
  desde?: string;
  hasta?: string;
  vencidas?: boolean;
  sort?: 'fecha_entrega' | 'fecha_creacion' | 'titulo';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export interface CrearTareaInput {
  materia_id: string;
  titulo: string;
  descripcion?: string | null;
  tipo: TipoTarea;
  prioridad: PrioridadTarea;
  fecha_asignacion?: string;
  fecha_entrega?: string | null;
  estado?: EstadoTarea;
}

export type ActualizarTareaInput = Partial<CrearTareaInput>;

const ETIQUETAS_TIPO: Record<TipoTarea, string> = {
  tarea: 'Tarea',
  taller: 'Taller',
  parcial: 'Parcial',
  examen: 'Examen',
  proyecto: 'Proyecto',
  exposicion: 'Exposición',
  laboratorio: 'Laboratorio',
  practica: 'Práctica',
  otro: 'Otro',
};

const ETIQUETAS_ESTADO: Record<EstadoTarea, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

const ETIQUETAS_PRIORIDAD: Record<PrioridadTarea, string> = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const CLASES_ESTADO: Record<EstadoTarea, string> = {
  pendiente: 'mat-badge mat-badge--warning',
  en_progreso: 'mat-badge mat-badge--info',
  completada: 'mat-badge mat-badge--success',
};

const CLASES_PRIORIDAD: Record<PrioridadTarea, string> = {
  baja: 'mat-badge mat-badge--muted',
  media: 'mat-badge mat-badge--primary',
  alta: 'mat-badge mat-badge--danger',
};

@Injectable({ providedIn: 'root' })
export class TareaService {
  private readonly api = inject(ApiService);

  listarTareas(filtros: TareaFiltros = {}): Observable<TareaListado> {
    return this.api
      .getWithMeta<Tarea[], { paginacion: Paginacion }>('/tareas', filtros)
      .pipe(
        map(({ data, meta }) => ({
          tareas: data,
          paginacion: meta.paginacion,
        })),
      );
  }

  listarProximas(dias = 7, limit = 5): Observable<TareasProximas> {
    return this.api
      .getWithMeta<Tarea[], { total: number; rango: RangoProximas }>('/tareas/proximas', {
        dias,
        limit,
      })
      .pipe(
        map(({ data, meta }) => ({
          tareas: data,
          rango: meta.rango,
        })),
      );
  }

  obtenerEstadisticas(): Observable<TareaEstadisticas> {
    return this.api.get<TareaEstadisticas>('/tareas/estadisticas');
  }

  obtenerTarea(id: string): Observable<Tarea> {
    return this.api.get<Tarea>(`/tareas/${id}`);
  }

  crearTarea(input: CrearTareaInput): Observable<Tarea> {
    return this.api.post<Tarea>('/tareas', input);
  }

  actualizarTarea(id: string, input: ActualizarTareaInput): Observable<Tarea> {
    return this.api.put<Tarea>(`/tareas/${id}`, input);
  }

  cambiarEstadoTarea(id: string, estado: EstadoTarea): Observable<Tarea> {
    return this.api.patch<Tarea>(`/tareas/${id}/estado`, { estado });
  }

  eliminarTarea(id: string): Observable<void> {
    return this.api.delete<void>(`/tareas/${id}`);
  }

  obtenerTipoTexto(tipo: TipoTarea): string {
    return ETIQUETAS_TIPO[tipo] ?? ETIQUETAS_TIPO.otro;
  }

  obtenerEstadoTexto(estado: EstadoTarea): string {
    return ETIQUETAS_ESTADO[estado] ?? ETIQUETAS_ESTADO.pendiente;
  }

  obtenerPrioridadTexto(prioridad: PrioridadTarea): string {
    return ETIQUETAS_PRIORIDAD[prioridad] ?? ETIQUETAS_PRIORIDAD.media;
  }

  obtenerEstadoBadgeClase(estado: EstadoTarea): string {
    return CLASES_ESTADO[estado] ?? CLASES_ESTADO.pendiente;
  }

  obtenerPrioridadBadgeClase(prioridad: PrioridadTarea): string {
    return CLASES_PRIORIDAD[prioridad] ?? CLASES_PRIORIDAD.media;
  }

  esTareaVencida(tarea: Pick<Tarea, 'fecha_entrega' | 'estado'>): boolean {
    if (!tarea.fecha_entrega || tarea.estado === 'completada') {
      return false;
    }

    return new Date(tarea.fecha_entrega).getTime() < Date.now();
  }

  obtenerMateriaDeTarea(tarea: Tarea): MateriaResumenTarea | null {
    const materias = tarea.materias;

    if (Array.isArray(materias)) {
      return materias[0] ?? null;
    }

    return materias ?? null;
  }

  formatearFecha(fecha: string | null, vacio = 'Sin fecha'): string {
    if (!fecha) {
      return vacio;
    }

    return new Date(fecha).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  /**
   * Convierte una fecha de un input date (YYYY-MM-DD) al inicio del día UTC.
   */
  aFechaAsignacionIso(fechaLocal: string): string {
    return `${fechaLocal}T00:00:00.000Z`;
  }

  /**
   * Convierte una fecha de un input date al final del día UTC.
   * Así una tarea que vence hoy no se marca vencida hasta mañana.
   */
  aFechaEntregaIso(fechaLocal: string): string {
    return `${fechaLocal}T23:59:59.000Z`;
  }

  /**
   * Convierte una fecha ISO al valor YYYY-MM-DD del input date.
   */
  aFechaInput(fecha: string | null): string {
    if (!fecha) {
      return '';
    }

    return fecha.slice(0, 10);
  }
}
