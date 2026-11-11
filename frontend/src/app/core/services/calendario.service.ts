import { Injectable, inject } from '@angular/core';
import type { EventInput } from '@fullcalendar/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export const TIPOS_EVENTO = [
  'examen',
  'entrega',
  'clase',
  'estudio',
  'personal',
  'otro',
] as const;

export type TipoEvento = (typeof TIPOS_EVENTO)[number];

export interface MateriaResumenEvento {
  nombre: string;
  codigo: string;
  color: string;
}

export interface EventoCalendario {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  tarea_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo_evento: TipoEvento;
  fecha_inicio: string;
  fecha_fin: string | null;
  recordatorio: number | null;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  materias?: MateriaResumenEvento | MateriaResumenEvento[] | null;
}

export interface Paginacion {
  limit: number;
  offset: number;
  total: number;
}

export interface EventoListado {
  eventos: EventoCalendario[];
  paginacion: Paginacion;
}

export interface RangoProximos {
  dias: number;
  desde: string;
  hasta: string;
}

export interface EventosProximos {
  eventos: EventoCalendario[];
  rango: RangoProximos;
}

export type EventoFiltros = {
  materia_id?: string;
  tipo_evento?: TipoEvento;
  desde: string;
  hasta: string;
  query?: string;
  sort?: 'fecha_inicio' | 'fecha_creacion' | 'titulo';
  order?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
};

export interface CrearEventoInput {
  materia_id?: string | null;
  tarea_id?: string | null;
  titulo: string;
  descripcion?: string | null;
  tipo_evento: TipoEvento;
  fecha_inicio: string;
  fecha_fin?: string | null;
  recordatorio?: number | null;
}

export type ActualizarEventoInput = Partial<CrearEventoInput>;

const ETIQUETAS_TIPO: Record<TipoEvento, string> = {
  examen: 'Examen',
  entrega: 'Entrega',
  clase: 'Clase',
  estudio: 'Estudio',
  personal: 'Personal',
  otro: 'Otro',
};

const COLORES_TIPO: Record<TipoEvento, string> = {
  examen: '#EF4444', // red-500
  entrega: '#3B82F6', // blue-500
  clase: '#10B981', // emerald-500
  estudio: '#8B5CF6', // violet-500
  personal: '#F59E0B', // amber-500
  otro: '#6B7280', // gray-500
};

const CLASES_TIPO: Record<TipoEvento, string> = {
  examen: 'badge text-bg-danger',
  entrega: 'badge text-bg-primary',
  clase: 'badge text-bg-success',
  estudio: 'badge text-bg-info',
  personal: 'badge text-bg-warning',
  otro: 'badge text-bg-secondary',
};

export interface TipoEventoOpcion {
  valor: TipoEvento;
  etiqueta: string;
  color: string;
}

export const TIPOS_EVENTO_OPCIONES: readonly TipoEventoOpcion[] = TIPOS_EVENTO.map((valor) => ({
  valor,
  etiqueta: ETIQUETAS_TIPO[valor],
  color: COLORES_TIPO[valor],
}));

@Injectable({ providedIn: 'root' })
export class CalendarioService {
  private readonly api = inject(ApiService);

  listarEventos(filtros: EventoFiltros): Observable<EventoListado> {
    return this.api
      .getWithMeta<EventoCalendario[], { paginacion: Paginacion }>('/calendario', filtros)
      .pipe(
        map(({ data, meta }) => ({
          eventos: data,
          paginacion: meta.paginacion,
        })),
      );
  }

  listarProximos(dias = 7, limit = 10): Observable<EventosProximos> {
    return this.api
      .getWithMeta<EventoCalendario[], { total: number; rango: RangoProximos }>('/calendario/proximos', {
        dias,
        limit,
      })
      .pipe(
        map(({ data, meta }) => ({
          eventos: data,
          rango: meta.rango,
        })),
      );
  }

  obtenerEvento(id: string): Observable<EventoCalendario> {
    return this.api.get<EventoCalendario>(`/calendario/${id}`);
  }

  crearEvento(input: CrearEventoInput): Observable<EventoCalendario> {
    return this.api.post<EventoCalendario>('/calendario', input);
  }

  actualizarEvento(id: string, input: ActualizarEventoInput): Observable<EventoCalendario> {
    return this.api.put<EventoCalendario>(`/calendario/${id}`, input);
  }

  eliminarEvento(id: string): Observable<void> {
    return this.api.delete<void>(`/calendario/${id}`);
  }

  obtenerTipoTexto(tipo: TipoEvento): string {
    return ETIQUETAS_TIPO[tipo] ?? ETIQUETAS_TIPO.otro;
  }

  obtenerColorTipo(tipo: TipoEvento): string {
    return COLORES_TIPO[tipo] ?? COLORES_TIPO.otro;
  }

  obtenerTipoBadgeClase(tipo: TipoEvento): string {
    return CLASES_TIPO[tipo] ?? CLASES_TIPO.otro;
  }

  obtenerMateriaDeEvento(evento: EventoCalendario): MateriaResumenEvento | null {
    const materias = evento.materias;

    if (Array.isArray(materias)) {
      return materias[0] ?? null;
    }

    return materias ?? null;
  }

  formatearFechaHora(fecha: string | null, vacio = 'Sin fecha'): string {
    if (!fecha) {
      return vacio;
    }

    return new Date(fecha).toLocaleString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    });
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
   * Convierte una fecha de un input datetime-local al formato ISO UTC.
   * El input entrega "YYYY-MM-DDTHH:mm" (sin segundos ni zona).
   */
  aFechaIso(fechaLocal: string): string {
    if (!fechaLocal) {
      return '';
    }

    return fechaLocal.length === 16 ? `${fechaLocal}:00.000Z` : new Date(fechaLocal).toISOString();
  }

  /**
   * Convierte una fecha ISO al valor YYYY-MM-DDTHH:mm del input datetime-local.
   */
  aFechaInput(fecha: string | null): string {
    if (!fecha) {
      return '';
    }

    // Extraer YYYY-MM-DDTHH:mm
    return fecha.slice(0, 16);
  }

  /**
   * Obtiene eventos adaptados para FullCalendar.
   */
  aEventosFullCalendar(eventos: EventoCalendario[]): EventInput[] {
    return eventos.map((evento) => {
      const materia = this.obtenerMateriaDeEvento(evento);
      const color = materia?.color ?? this.obtenerColorTipo(evento.tipo_evento);

      return {
        id: evento.id,
        title: evento.titulo,
        start: evento.fecha_inicio,
        end: evento.fecha_fin ?? undefined,
        backgroundColor: color,
        borderColor: color,
        extendedProps: {
          descripcion: evento.descripcion,
          tipo_evento: evento.tipo_evento,
          tipoTexto: this.obtenerTipoTexto(evento.tipo_evento),
          materia: materia?.nombre,
          recordatorio: evento.recordatorio,
        },
      };
    });
  }
}