import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface Materia {
  id: string;
  usuario_id: string;
  nombre: string;
  codigo: string;
  docente: string;
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

export interface MateriaDetalle extends Materia {
  // Puede extenderse con información adicional si es necesario
}

export interface MateriaListadoResponse {
  success: boolean;
  data: Materia[];
  meta: {
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
  };
}

export interface MateriaDetalleResponse {
  success: boolean;
  data: MateriaDetalle;
}

export interface CrearMateriaRequest {
  nombre: string;
  codigo: string;
  docente: string;
  descripcion?: string | null;
  periodo_academico: string;
  color?: string;
}

export interface ActualizarMateriaRequest {
  nombre?: string;
  codigo?: string;
  docente?: string;
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

@Injectable({
  providedIn: 'root'
})
export class MateriaService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/materias`;

  /**
   * Lista materias del usuario actual con filtros opcionales
   */
  listarMaterias(filtros: MateriaFiltros = {}): Observable<MateriaListadoResponse> {
    let params = new HttpParams();
    
    if (filtros.query) params = params.set('query', filtros.query);
    if (filtros.periodo_academico) params = params.set('periodo_academico', filtros.periodo_academico);
    if (filtros.estado) params = params.set('estado', filtros.estado);
    if (filtros.limit) params = params.set('limit', filtros.limit.toString());
    if (filtros.offset) params = params.set('offset', filtros.offset.toString());

    return this.http.get<MateriaListadoResponse>(this.apiUrl, { params })
      .pipe(catchError(this.handleError));
  }

  /**
   * Obtiene una materia específica por ID
   */
  obtenerMateria(id: string): Observable<MateriaDetalle> {
    return this.http.get<MateriaDetalleResponse>(`${this.apiUrl}/${id}`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Crea una nueva materia
   */
  crearMateria(materia: CrearMateriaRequest): Observable<Materia> {
    return this.http.post<{ success: boolean; data: Materia; message: string }>(this.apiUrl, materia)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Actualiza una materia existente
   */
  actualizarMateria(id: string, cambios: ActualizarMateriaRequest): Observable<Materia> {
    return this.http.patch<{ success: boolean; data: Materia; message: string }>(
      `${this.apiUrl}/${id}`, 
      cambios
    ).pipe(
      map(response => response.data),
      catchError(this.handleError)
    );
  }

  /**
   * Cambia el estado de una materia (activar/archivar)
   */
  cambiarEstadoMateria(id: string, estado: 'activo' | 'archivado'): Observable<{ materiaId: string; estado: string }> {
    return this.http.patch<{ 
      success: boolean; 
      data: { materiaId: string; estado: string }; 
      message: string 
    }>(`${this.apiUrl}/${id}/estado`, { estado })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Busca materias por término (nombre, código o docente)
   */
  buscarMaterias(termino: string, limit: number = 10): Observable<Materia[]> {
    const params = new HttpParams()
      .set('q', termino)
      .set('limit', limit.toString());

    return this.http.get<{ success: boolean; data: Materia[] }>(`${this.apiUrl}/buscar`, { params })
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Obtiene estadísticas de materias
   */
  obtenerEstadisticas(): Observable<MateriaEstadisticas> {
    return this.http.get<{ success: boolean; data: MateriaEstadisticas }>(`${this.apiUrl}/estadisticas`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Obtiene los colores disponibles para materias
   */
  obtenerColoresDisponibles(): Observable<string[]> {
    return this.http.get<{ success: boolean; data: string[] }>(`${this.apiUrl}/colores`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Obtiene los periodos académicos del usuario
   */
  obtenerPeriodosAcademicos(): Observable<string[]> {
    return this.http.get<{ success: boolean; data: string[] }>(`${this.apiUrl}/periodos`)
      .pipe(
        map(response => response.data),
        catchError(this.handleError)
      );
  }

  /**
   * Valida si el usuario tiene acceso a una materia específica
   */
  validarAccesoMateria(id: string): Observable<boolean> {
    return this.http.get<{ success: boolean; data: { tieneAcceso: boolean; materiaId: string } }>(
      `${this.apiUrl}/${id}/acceso`
    ).pipe(
      map(response => response.data.tieneAcceso),
      catchError(() => [false])
    );
  }

  /**
   * Formatea el nombre completo de la materia (nombre + código)
   */
  formatearNombreCompleto(materia: Materia): string {
    return `${materia.nombre} (${materia.codigo})`;
  }

  /**
   * Obtiene el texto del estado de la materia
   */
  obtenerEstadoTexto(estado: 'activo' | 'archivado'): string {
    return estado === 'activo' ? 'Activa' : 'Archivada';
  }

  /**
   * Valida el formato del periodo académico
   */
  validarPeriodoAcademico(periodo: string): boolean {
    const regex = /^\d{4}-[12]$/;
    return regex.test(periodo);
  }

  /**
   * Genera el siguiente periodo académico
   */
  generarPeriodoSiguiente(periodoActual: string): string {
    if (!this.validarPeriodoAcademico(periodoActual)) {
      throw new Error('Periodo académico inválido');
    }
    
    const [anio, semestre] = periodoActual.split('-');
    
    if (semestre === '1') {
      return `${anio}-2`;
    } else {
      return `${(parseInt(anio) + 1).toString()}-1`;
    }
  }

  /**
   * Obtiene la descripción del periodo académico
   */
  obtenerDescripcionPeriodo(periodo: string): string {
    if (!this.validarPeriodoAcademico(periodo)) {
      return periodo;
    }
    
    const [anio, semestre] = periodo.split('-');
    const semestreTexto = semestre === '1' ? 'Primer' : 'Segundo';
    
    return `${semestreTexto} semestre ${anio}`;
  }

  /**
   * Manejo centralizado de errores HTTP
   */
  private handleError(error: any): Observable<never> {
    let errorMessage = 'Error desconocido';
    
    if (error.error instanceof ErrorEvent) {
      // Error del cliente
      errorMessage = `Error: ${error.error.message}`;
    } else {
      // Error del servidor
      switch (error.status) {
        case 400:
          errorMessage = 'Datos inválidos';
          if (error.error?.meta?.issues) {
            const issues = error.error.meta.issues.map((issue: any) => issue.message).join(', ');
            errorMessage = `Error de validación: ${issues}`;
          }
          break;
        case 401:
          errorMessage = 'No autorizado';
          break;
        case 403:
          errorMessage = 'Acceso prohibido';
          break;
        case 404:
          errorMessage = 'Materia no encontrada';
          break;
        case 409:
          errorMessage = 'Ya existe una materia con ese código';
          break;
        case 422:
          errorMessage = 'Error de validación';
          break;
        case 500:
          errorMessage = 'Error interno del servidor';
          break;
        default:
          errorMessage = `Error ${error.status}: ${error.statusText}`;
      }
      
      // Mensaje específico del servidor si existe
      if (error.error?.message) {
        errorMessage = error.error.message;
      }
    }
    
    console.error('Error en MateriaService:', error);
    return throwError(() => new Error(errorMessage));
  }
}