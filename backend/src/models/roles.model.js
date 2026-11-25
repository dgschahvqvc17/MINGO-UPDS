/**
 * Catalogo de roles del dominio.
 * Se usa en validaciones, resolucion de sesion y reglas de autorizacion.
 */
const ROLE_ADMINISTRADOR = 'administrador';
const ROLE_DOCENTE = 'docente';
const ROLE_ESTUDIANTE = 'estudiante';

const ROLES = Object.freeze([ROLE_ADMINISTRADOR, ROLE_DOCENTE, ROLE_ESTUDIANTE]);

/** Orden de precedencia: un usuario con varios roles usa el mas privilegiado. */
const ROLE_PRIORITY = Object.freeze([ROLE_ADMINISTRADOR, ROLE_DOCENTE, ROLE_ESTUDIANTE]);

module.exports = {
  ROLE_ADMINISTRADOR,
  ROLE_DOCENTE,
  ROLE_ESTUDIANTE,
  ROLES,
  ROLE_PRIORITY,
};
