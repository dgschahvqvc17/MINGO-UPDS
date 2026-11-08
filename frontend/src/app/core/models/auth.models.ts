import type { RolUsuario } from './dominio.models';

export type EstadoCuenta = 'activo' | 'inactivo';

/**
 * Usuario autenticado tal como lo devuelve GET /api/auth/me.
 * El rol y el estado provienen de la base de datos, no de los metadatos del JWT.
 */
export interface UsuarioSesion {
  id: string;
  email: string;
  nombre: string;
  apellido: string;
  correo: string;
  estado: EstadoCuenta;
  role: RolUsuario;
  roles: RolUsuario[];
}
