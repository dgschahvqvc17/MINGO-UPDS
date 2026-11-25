import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface Materia {
  id: string;
  usuario_id: string;
  nombre: string;
  codigo: string;
  /** Nombre legible del docente, mantenido por el backend para compatibilidad. */
  docente: string;
  /** Usuario con rol docente responsable de la materia. */
  docente_id: string | null;
  descripcion: string | null;
  periodo_academico: string;
  color: string;
  estado: 'activo' | 'archivado';
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  total_tareas: number;
  tareas_pendientes: number;
  total_documentos: number;
}

export interface MateriaDetalle extends Materia {}

export interface MateriaListadoMeta {
  paginacion: {
    limit: number;
    offset: number;
    total: number;
  };
  estadisticas: {
    total: number;
    activas: number;
    archivadas: number;
    por_periodo: Record<string, number>;
  };
  periodos_academicos: string[];
  colores_disponibles: string[];
}

export interface MateriaListadoResponse {
  success: boolean;
  data: Materia[];
  meta: MateriaListadoMeta;
}

export interface MateriaDetalleResponse {
  success: boolean;
  data: MateriaDetalle;
}

export interface CrearMateriaRequest {
  nombre: string;
  codigo: string;
  /** Se envía junto al ID para mantener compatible el despliegue actual del backend. */
  docente: string;
  docente_id: string;
  descripcion?: string | null;
  periodo_academico: string;
  color?: string;
}

export interface ActualizarMateriaRequest {
  nombre?: string;
  codigo?: string;
  docente?: string;
  docente_id?: string;
  descripcion?: string | null;
  periodo_academico?: string;
  color?: string;
  estado?: 'activo' | 'archivado';
}

export interface MateriaEstadisticas {
  total: number;
  activas: number;
  archivadas: number;
  por_periodo: Record<string, number>;
  periodos_academicos: string[];
}

export interface MateriaFiltros {
  query?: string;
  periodo_academico?: string;
  estado?: 'activo' | 'archivado';
  limit?: number;
  offset?: number;
}

@Injectable({ providedIn: 'root' })
export class MateriaService {
  private readonly api = inject(ApiService);

  listarMaterias(filtros: MateriaFiltros = {}): Observable<MateriaListadoResponse> {
    return this.api
      .getWithMeta<Materia[], MateriaListadoMeta>('materias', {
        query: filtros.query,
        periodo_academico: filtros.periodo_academico,
        estado: filtros.estado,
        limit: filtros.limit,
        offset: filtros.offset,
      })
      .pipe(map(({ data, meta }) => ({ success: true, data, meta })));
  }

  obtenerMateria(id: string): Observable<MateriaDetalle> {
    return this.api.get<MateriaDetalle>(`materias/${id}`);
  }

  crearMateria(materia: CrearMateriaRequest): Observable<Materia> {
    return this.api.post<Materia>('materias', materia);
  }

  actualizarMateria(id: string, cambios: ActualizarMateriaRequest): Observable<Materia> {
    return this.api.patch<Materia>(`materias/${id}`, cambios);
  }

  cambiarEstadoMateria(
    id: string,
    estado: 'activo' | 'archivado',
  ): Observable<{ materiaId: string; estado: string }> {
    return this.api.patch<{ materiaId: string; estado: string }>(`materias/${id}/estado`, {
      estado,
    });
  }

  buscarMaterias(termino: string, limit = 10): Observable<Materia[]> {
    return this.api.get<Materia[]>('materias/buscar', { q: termino, limit });
  }

  obtenerEstadisticas(): Observable<MateriaEstadisticas> {
    return this.api.get<MateriaEstadisticas>('materias/estadisticas');
  }

  obtenerColoresDisponibles(): Observable<string[]> {
    return this.api.get<string[]>('materias/colores');
  }

  obtenerPeriodosAcademicos(): Observable<string[]> {
    return this.api.get<string[]>('materias/periodos');
  }

  validarAccesoMateria(id: string): Observable<boolean> {
    return this.api
      .get<{ tieneAcceso: boolean; materiaId: string }>(`materias/${id}/acceso`)
      .pipe(
        map((respuesta) => respuesta.tieneAcceso),
      );
  }

  formatearNombreCompleto(materia: Materia): string {
    return `${materia.nombre} (${materia.codigo})`;
  }

  obtenerEstadoTexto(estado: 'activo' | 'archivado'): string {
    return estado === 'activo' ? 'Activa' : 'Archivada';
  }

  validarPeriodoAcademico(periodo: string): boolean {
    return /^\d{4}-[12]$/.test(periodo);
  }

  generarPeriodoSiguiente(periodoActual: string): string {
    if (!this.validarPeriodoAcademico(periodoActual)) {
      throw new Error('Periodo académico inválido');
    }

    const [anio, semestre] = periodoActual.split('-');
    return semestre === '1' ? `${anio}-2` : `${Number(anio) + 1}-1`;
  }

  obtenerDescripcionPeriodo(periodo: string): string {
    if (!this.validarPeriodoAcademico(periodo)) {
      return periodo;
    }

    const [anio, semestre] = periodo.split('-');
    return `${semestre === '1' ? 'Primer' : 'Segundo'} semestre ${anio}`;
  }
}
