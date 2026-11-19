/**
 * Persistencia de claves Idempotency-Key (HU12).
 * Usa el cliente del usuario: RLS limita cada clave a su propietario.
 * No conoce HTTP ni reglas de negocio.
 */

const COLUMNAS = `
  id,
  usuario_id,
  endpoint,
  clave,
  huella,
  estado,
  respuesta,
  fecha_creacion,
  fecha_actualizacion
`;

/** Codigo PostgreSQL de violacion de restriccion unica. */
const CODIGO_UNICIDAD = '23505';

class IdempotenciaRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * @param {string} usuarioId
   * @param {string} endpoint
   * @param {string} clave
   * @returns {Promise<object | null>}
   */
  async buscar(usuarioId, endpoint, clave) {
    const { data, error } = await this.requireClient()
      .from('solicitudes_idempotentes')
      .select(COLUMNAS)
      .eq('usuario_id', usuarioId)
      .eq('endpoint', endpoint)
      .eq('clave', clave)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Reserva la clave. Devuelve null si otro intento ya la tomo.
   *
   * @param {{ usuarioId: string, endpoint: string, clave: string, huella: string }} solicitud
   * @returns {Promise<object | null>}
   */
  async reservar({ usuarioId, endpoint, clave, huella }) {
    const { data, error } = await this.requireClient()
      .from('solicitudes_idempotentes')
      .insert({
        usuario_id: usuarioId,
        endpoint,
        clave,
        huella,
      })
      .select(COLUMNAS)
      .single();

    if (error) {
      if (error.code === CODIGO_UNICIDAD) {
        return null;
      }

      throw error;
    }

    return data;
  }

  /**
   * @param {string} id
   * @param {object} respuesta
   * @returns {Promise<void>}
   */
  async completar(id, respuesta) {
    const { error } = await this.requireClient()
      .from('solicitudes_idempotentes')
      .update({
        estado: 'completado',
        respuesta,
        fecha_actualizacion: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Libera una reserva que no llego a producir respuesta.
   *
   * @param {string} id
   * @returns {Promise<void>}
   */
  async liberar(id) {
    const { error } = await this.requireClient()
      .from('solicitudes_idempotentes')
      .delete()
      .eq('id', id);

    if (error) {
      throw error;
    }
  }

  /**
   * Elimina las claves del usuario anteriores a la fecha indicada.
   *
   * @param {string} usuarioId
   * @param {string} endpoint
   * @param {string} fechaLimite ISO 8601.
   * @returns {Promise<void>}
   */
  async limpiarAntiguas(usuarioId, endpoint, fechaLimite) {
    const { error } = await this.requireClient()
      .from('solicitudes_idempotentes')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('endpoint', endpoint)
      .lt('fecha_creacion', fechaLimite);

    if (error) {
      throw error;
    }
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = IdempotenciaRepository;
module.exports.COLUMNAS = COLUMNAS;
module.exports.CODIGO_UNICIDAD = CODIGO_UNICIDAD;
