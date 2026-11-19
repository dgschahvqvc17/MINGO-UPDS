/**
 * Registro de consumo de IA por usuario (HU10).
 * Sirve para aplicar cuotas diarias y dejar traza de tokens consumidos.
 * Usa el cliente del usuario para que RLS limite lectura y escritura.
 */

class ConsumoIaRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Cuenta las operaciones de un tipo desde una fecha (ISO 8601).
   *
   * @param {string} usuarioId
   * @param {string} operacion
   * @param {string} desde ISO 8601.
   * @returns {Promise<number>}
   */
  async contar(usuarioId, operacion, desde) {
    const { count, error } = await this.requireClient()
      .from('consumo_ia')
      .select('id', { count: 'exact', head: true })
      .eq('usuario_id', usuarioId)
      .eq('operacion', operacion)
      .gte('fecha', desde);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  /**
   * Registra una operacion y devuelve su identificador.
   *
   * @param {{ usuario_id: string, operacion: string, modelo: string, tokens_entrada: number, tokens_salida: number }} consumo
   * @returns {Promise<string>}
   */
  async registrar(consumo) {
    const { data, error } = await this.requireClient()
      .from('consumo_ia')
      .insert(consumo)
      .select('id')
      .single();

    if (error) {
      throw error;
    }

    return data.id;
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = ConsumoIaRepository;
