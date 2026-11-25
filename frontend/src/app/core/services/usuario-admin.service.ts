import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { RolUsuario } from '../models/dominio.models';
import { ApiService } from './api.service';

export interface UsuarioListado {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  carrera: string | null;
  estado: 'activo' | 'inactivo';
  fecha_creacion: string;
  roles: RolUsuario[];
}

export interface UsuarioDetalle extends UsuarioListado {
  roles_detalle: Array<{
    id: number;
    nombre: string;
    descripcion: string | null;
  }>;
}

export interface RolDisponible {
  id: number;
  nombre: string;
  descripcion: string | null;
}

export interface UsuarioBusquedaParams {
  query?: string;
  estado?: 'activo' | 'inactivo';
  rol?: RolUsuario;
  limit?: number;
  offset?: number;
}

export interface UsuarioListadoResponse {
  usuarios: UsuarioListado[];
  paginacion: {
    limit: number;
    offset: number;
    total: number;
  };
  estadisticas: {
    total: number;
    activos: number;
    inactivos: number;
    administradores: number;
    docentes?: number;
    estudiantes: number;
  };
}

type UsuarioListadoMeta = Omit<UsuarioListadoResponse, 'usuarios'>;

export interface CrearUsuarioRequest {
  nombre: string;
  apellido: string;
  correo: string;
  carrera?: string;
  rol: RolUsuario;
  claveTemporal: string;
}

export interface UsuarioCreado extends UsuarioListado {
  claveTemporal: string;
}

export interface ActualizarRolesRequest {
  roles: RolUsuario[];
}

export interface ActualizarEstadoRequest {
  estado: 'activo' | 'inactivo';
}

@Injectable({ providedIn: 'root' })
export class UsuarioAdminService {
  private readonly api = inject(ApiService);

  /**
   * Lista usuarios con opciones de búsqueda y paginación
   */
  listarUsuarios(params: UsuarioBusquedaParams = {}): Observable<UsuarioListadoResponse> {
    return this.api
      .getWithMeta<UsuarioListado[], UsuarioListadoMeta>('usuarios', {
        query: params.query,
        estado: params.estado,
        rol: params.rol,
        limit: params.limit,
        offset: params.offset,
      })
      .pipe(
        map(({ data, meta }) => ({
          usuarios: data ?? [],
          ...meta,
        })),
      );
  }

  /** Da de alta un usuario con clave temporal; la respuesta la devuelve una sola vez. */
  crearUsuario(solicitud: CrearUsuarioRequest): Observable<UsuarioCreado> {
    return this.api.post<UsuarioCreado>('usuarios', solicitud);
  }

  /** Lista docentes para el selector de materias. */
  listarDocentes(): Observable<UsuarioListado[]> {
    return this.listarUsuarios({ rol: 'docente', limit: 100 }).pipe(
      map((respuesta) => respuesta.usuarios),
    );
  }

  /** Lista estudiantes para el selector de inscripciones. */
  listarEstudiantes(): Observable<UsuarioListado[]> {
    return this.listarUsuarios({ rol: 'estudiante', limit: 100 }).pipe(
      map((respuesta) => respuesta.usuarios),
    );
  }

  /**
   * Obtiene un usuario específico por ID
   */
  obtenerUsuario(id: string): Observable<UsuarioDetalle> {
    return this.api.get<UsuarioDetalle>(`usuarios/${id}`);
  }

  /**
   * Busca usuarios rápidamente por nombre, apellido o correo
   */
  buscarUsuarios(termino: string, limit = 20): Observable<UsuarioListado[]> {
    return this.api.get<UsuarioListado[]>(`usuarios/buscar?termino=${encodeURIComponent(termino)}&limit=${limit}`);
  }

  /**
   * Obtiene todos los roles disponibles en el sistema
   */
  obtenerRolesDisponibles(): Observable<RolDisponible[]> {
    return this.api.get<RolDisponible[]>('usuarios/roles');
  }

  /**
   * Actualiza los roles de un usuario
   */
  actualizarRolesUsuario(id: string, roles: RolUsuario[]): Observable<{ mensaje: string; usuarioId: string; roles: RolUsuario[] }> {
    return this.api.patch<{ mensaje: string; usuarioId: string; roles: RolUsuario[] }>(
      `usuarios/${id}/roles`,
      { roles }
    );
  }

  /**
   * Actualiza el estado (activo/inactivo) de un usuario
   */
  actualizarEstadoUsuario(id: string, estado: 'activo' | 'inactivo'): Observable<{ mensaje: string; usuarioId: string; estado: string }> {
    return this.api.patch<{ mensaje: string; usuarioId: string; estado: string }>(
      `usuarios/${id}/estado`,
      { estado }
    );
  }

  /**
   * Métodos auxiliares para formatear datos de usuario
   */
  
  obtenerNombreCompleto(usuario: UsuarioListado): string {
    return `${usuario.nombre} ${usuario.apellido}`.trim();
  }

  obtenerRolesTexto(usuario: UsuarioListado): string {
    const etiquetas: Record<RolUsuario, string> = {
      administrador: 'Administrador',
      docente: 'Docente',
      estudiante: 'Estudiante',
    };

    return usuario.roles.map((role) => etiquetas[role] ?? role).join(', ');
  }

  obtenerEstadoTexto(estado: 'activo' | 'inactivo'): string {
    return estado === 'activo' ? 'Activo' : 'Inactivo';
  }

  obtenerEstadoBadgeClase(estado: 'activo' | 'inactivo'): string {
    return estado === 'activo' ? 'badge bg-success' : 'badge bg-danger';
  }

  obtenerRolBadgeClase(rol: RolUsuario | string): string {
    if (rol === 'administrador') {
      return 'badge bg-warning text-dark';
    }

    if (rol === 'docente') {
      return 'badge bg-primary';
    }

    return 'badge bg-info';
  }

  /**
   * Validaciones de seguridad
   */
  validarNoAutoModificacion(usuarioId: string, usuarioActualId: string): boolean {
    return usuarioId !== usuarioActualId;
  }

  obtenerMensajeValidacion(esValido: boolean, operacion: string): string {
    return esValido 
      ? '' 
      : `No puedes ${operacion.toLowerCase()} tus propios privilegios`;
  }
}