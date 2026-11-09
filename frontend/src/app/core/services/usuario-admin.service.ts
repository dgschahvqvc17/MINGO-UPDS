import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { map, Observable } from 'rxjs';

export interface UsuarioListado {
  id: string;
  nombre: string;
  apellido: string;
  correo: string;
  carrera: string | null;
  estado: 'activo' | 'inactivo';
  fecha_creacion: string;
  roles: string[];
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
  rol?: 'administrador' | 'estudiante';
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
    estudiantes: number;
  };
}

export interface ActualizarRolesRequest {
  roles: Array<'administrador' | 'estudiante'>;
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
    const queryParams = new URLSearchParams();
    
    if (params.query) queryParams.set('query', params.query);
    if (params.estado) queryParams.set('estado', params.estado);
    if (params.rol) queryParams.set('rol', params.rol);
    if (params.limit) queryParams.set('limit', params.limit.toString());
    if (params.offset) queryParams.set('offset', params.offset.toString());

    const queryString = queryParams.toString();
    const url = `usuarios${queryString ? `?${queryString}` : ''}`;

    return this.api.get<UsuarioListadoResponse>(url);
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
  actualizarRolesUsuario(id: string, roles: Array<'administrador' | 'estudiante'>): Observable<{ mensaje: string; usuarioId: string; roles: string[] }> {
    return this.api.patch<{ mensaje: string; usuarioId: string; roles: string[] }>(
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
    return usuario.roles
      .map(role => role === 'administrador' ? 'Administrador' : 'Estudiante')
      .join(', ');
  }

  obtenerEstadoTexto(estado: 'activo' | 'inactivo'): string {
    return estado === 'activo' ? 'Activo' : 'Inactivo';
  }

  obtenerEstadoBadgeClase(estado: 'activo' | 'inactivo'): string {
    return estado === 'activo' ? 'badge bg-success' : 'badge bg-danger';
  }

  obtenerRolBadgeClase(rol: string): string {
    return rol === 'administrador' ? 'badge bg-warning text-dark' : 'badge bg-info';
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