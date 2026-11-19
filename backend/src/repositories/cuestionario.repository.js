/**
 * Acceso a datos de cuestionarios, preguntas, opciones, intentos y respuestas
 * (HU13). Usa el cliente de Supabase del usuario para que RLS se aplique en
 * cada consulta. No conoce HTTP ni reglas de negocio.
 */

const CUESTIONARIO_COLUMNS = `
  id,
  usuario_id,
  materia_id,
  documento_id,
  titulo,
  dificultad,
  cantidad_preguntas,
  tipos,
  modelo,
  tokens_entrada,
  tokens_salida,
  fecha_creacion,
  materias ( nombre, codigo, color )
`;

const PREGUNTA_COLUMNS = `
  id,
  cuestionario_id,
  orden,
  enunciado,
  tipo_pregunta,
  respuesta_correcta,
  explicacion
`;

const OPCION_COLUMNS = `
  id,
  pregunta_id,
  orden,
  contenido,
  es_correcta
`;

const INTENTO_COLUMNS = `
  id,
  usuario_id,
  cuestionario_id,
  estado,
  total_preguntas,
  preguntas_objetivas,
  respuestas_correctas,
  puntuacion,
  fecha_inicio,
  fecha_finalizacion
`;

const RESPUESTA_COLUMNS = `
  id,
  intento_id,
  pregunta_id,
  respuesta,
  es_correcta,
  fecha_creacion
`;

class CuestionarioRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Guarda un cuestionario con sus preguntas y opciones.
   *
   * Supabase no expone transacciones multi-tabla desde el cliente REST, asi que
   * si falla un paso intermedio se elimina el cuestionario recien creado; el
   * borrado en cascada limpia preguntas y opciones.
   *
   * @param {object} cuestionario Columnas de `cuestionarios` sin id.
   * @param {Array<object>} preguntas Preguntas normalizadas con `opciones`.
   * @returns {Promise<object>} Cuestionario con preguntas y opciones guardadas.
   */
  async crearCuestionario(cuestionario, preguntas) {
    const { data: guardado, error } = await this.requireClient()
      .from('cuestionarios')
      .insert(cuestionario)
      .select(CUESTIONARIO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    try {
      const filasPreguntas = await this.insertarPreguntas(guardado.id, preguntas);
      return { ...guardado, preguntas: filasPreguntas };
    } catch (errorInsercion) {
      await this.eliminarCuestionario(cuestionario.usuario_id, guardado.id).catch(() => {});
      throw errorInsercion;
    }
  }

  /**
   * @param {string} cuestionarioId
   * @param {Array<object>} preguntas
   * @returns {Promise<Array<object>>}
   */
  async insertarPreguntas(cuestionarioId, preguntas) {
    const filas = preguntas.map((pregunta, indice) => ({
      cuestionario_id: cuestionarioId,
      orden: indice + 1,
      enunciado: pregunta.enunciado,
      tipo_pregunta: pregunta.tipo_pregunta,
      respuesta_correcta: pregunta.respuesta_correcta,
      explicacion: pregunta.explicacion,
    }));

    const { data: guardadas, error } = await this.requireClient()
      .from('preguntas')
      .insert(filas)
      .select(PREGUNTA_COLUMNS);

    if (error) {
      throw error;
    }

    const opciones = [];

    for (const preguntaGuardada of guardadas ?? []) {
      const original = preguntas[preguntaGuardada.orden - 1];
      const opcionesPregunta = original?.opciones ?? [];

      opcionesPregunta.forEach((opcion, indice) => {
        opciones.push({
          pregunta_id: preguntaGuardada.id,
          orden: indice + 1,
          contenido: opcion.contenido,
          es_correcta: opcion.es_correcta,
        });
      });
    }

    const opcionesPorPregunta = new Map();

    if (opciones.length > 0) {
      const { data: opcionesGuardadas, error: errorOpciones } = await this.requireClient()
        .from('opciones_pregunta')
        .insert(opciones)
        .select(OPCION_COLUMNS);

      if (errorOpciones) {
        throw errorOpciones;
      }

      for (const opcion of opcionesGuardadas ?? []) {
        const lista = opcionesPorPregunta.get(opcion.pregunta_id) ?? [];
        lista.push(opcion);
        opcionesPorPregunta.set(opcion.pregunta_id, lista);
      }
    }

    return (guardadas ?? [])
      .sort((a, b) => a.orden - b.orden)
      .map((pregunta) => ({
        ...pregunta,
        opciones: (opcionesPorPregunta.get(pregunta.id) ?? []).sort((a, b) => a.orden - b.orden),
      }));
  }

  /**
   * Lista los cuestionarios del usuario, del mas reciente al mas antiguo.
   *
   * @param {string} usuarioId
   * @param {{ limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarCuestionarios(usuarioId, { limit, offset }) {
    const { data, error, count } = await this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS, { count: 'exact' })
      .eq('usuario_id', usuarioId)
      .order('fecha_creacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * @param {string} usuarioId
   * @param {string} cuestionarioId
   * @returns {Promise<object | null>}
   */
  async obtenerCuestionarioPorId(usuarioId, cuestionarioId) {
    const { data, error } = await this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', cuestionarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Devuelve las preguntas de un cuestionario con sus opciones.
   *
   * @param {string} cuestionarioId
   * @returns {Promise<Array<object>>}
   */
  async listarPreguntas(cuestionarioId) {
    const { data: preguntas, error } = await this.requireClient()
      .from('preguntas')
      .select(PREGUNTA_COLUMNS)
      .eq('cuestionario_id', cuestionarioId)
      .order('orden', { ascending: true });

    if (error) {
      throw error;
    }

    if (!preguntas || preguntas.length === 0) {
      return [];
    }

    const ids = preguntas.map((pregunta) => pregunta.id);
    const { data: opciones, error: errorOpciones } = await this.requireClient()
      .from('opciones_pregunta')
      .select(OPCION_COLUMNS)
      .in('pregunta_id', ids)
      .order('orden', { ascending: true });

    if (errorOpciones) {
      throw errorOpciones;
    }

    const porPregunta = new Map();

    for (const opcion of opciones ?? []) {
      const lista = porPregunta.get(opcion.pregunta_id) ?? [];
      lista.push(opcion);
      porPregunta.set(opcion.pregunta_id, lista);
    }

    return preguntas.map((pregunta) => ({
      ...pregunta,
      opciones: porPregunta.get(pregunta.id) ?? [],
    }));
  }

  /**
   * @param {string} usuarioId
   * @param {string} cuestionarioId
   * @returns {Promise<void>}
   */
  async eliminarCuestionario(usuarioId, cuestionarioId) {
    const { error } = await this.requireClient()
      .from('cuestionarios')
      .delete()
      .eq('usuario_id', usuarioId)
      .eq('id', cuestionarioId);

    if (error) {
      throw error;
    }
  }

  /**
   * @param {object} intento Columnas de `intentos_cuestionario` sin id.
   * @returns {Promise<object>}
   */
  async crearIntento(intento) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .insert(intento)
      .select(INTENTO_COLUMNS)
      .single();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * @param {string} usuarioId
   * @param {string} intentoId
   * @returns {Promise<object | null>}
   */
  async obtenerIntentoPorId(usuarioId, intentoId) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .select(INTENTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('id', intentoId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista los intentos de un cuestionario propio.
   *
   * @param {string} usuarioId
   * @param {string} cuestionarioId
   * @returns {Promise<Array<object>>}
   */
  async listarIntentos(usuarioId, cuestionarioId) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .select(INTENTO_COLUMNS)
      .eq('usuario_id', usuarioId)
      .eq('cuestionario_id', cuestionarioId)
      .order('fecha_inicio', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Guarda las respuestas de un intento. Un reintento sobre la misma pregunta
   * actualiza la respuesta existente.
   *
   * @param {Array<{ intento_id: string, pregunta_id: string, respuesta: string, es_correcta: boolean | null }>} respuestas
   * @returns {Promise<Array<object>>}
   */
  async guardarRespuestas(respuestas) {
    const { data, error } = await this.requireClient()
      .from('respuestas_usuario')
      .upsert(respuestas, { onConflict: 'intento_id,pregunta_id' })
      .select(RESPUESTA_COLUMNS);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} intentoId
   * @returns {Promise<Array<object>>}
   */
  async listarRespuestas(usuarioId, intentoId) {
    const intento = await this.obtenerIntentoPorId(usuarioId, intentoId);

    if (!intento) {
      return [];
    }

    const { data, error } = await this.requireClient()
      .from('respuestas_usuario')
      .select(RESPUESTA_COLUMNS)
      .eq('intento_id', intentoId);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {string} usuarioId
   * @param {string} intentoId
   * @param {object} datos Columnas a actualizar.
   * @returns {Promise<object | null>}
   */
  async actualizarIntento(usuarioId, intentoId, datos) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .update(datos)
      .eq('usuario_id', usuarioId)
      .eq('id', intentoId)
      .select(INTENTO_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = CuestionarioRepository;
module.exports.CUESTIONARIO_COLUMNS = CUESTIONARIO_COLUMNS;
