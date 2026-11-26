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
  publicado,
  fecha_publicacion,
  fecha_inicio,
  fecha_limite,
  fecha_creacion,
  materias ( nombre, codigo, color )
`;

const PREGUNTA_COLUMNS = `
  id,
  cuestionario_id,
  orden,
  enunciado,
  tipo_pregunta,
  tema,
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
  retroalimentacion_general,
  temas_reforzar,
  recomendaciones,
  modelo_evaluacion,
  tokens_entrada_evaluacion,
  tokens_salida_evaluacion,
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

const EVALUACION_COLUMNS = `
  id,
  usuario_id,
  intento_id,
  pregunta_id,
  es_correcta,
  puntaje,
  retroalimentacion,
  temas_reforzar,
  criterios,
  modelo,
  tokens_entrada,
  tokens_salida,
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
      tema: pregunta.tema ?? 'Tema general',
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
   * Lista los intentos finalizados del usuario de todos sus cuestionarios,
   * del mas reciente al mas antiguo (HU16).
   *
   * @param {string} usuarioId
   * @param {{ limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarIntentosUsuario(usuarioId, { limit, offset }) {
    const { data, error, count } = await this.requireClient()
      .from('intentos_cuestionario')
      .select(
        `${INTENTO_COLUMNS}, cuestionarios ( id, titulo, materias ( nombre ) )`,
        { count: 'exact' },
      )
      .eq('usuario_id', usuarioId)
      .eq('estado', 'finalizado')
      .order('fecha_finalizacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * Lista los intentos del usuario para derivar el estado de los cuestionarios
   * proyectados en Tareas. Devuelve solo columnas de estado, nunca respuestas.
   *
   * @param {string} usuarioId
   * @returns {Promise<Array<{ cuestionario_id: string, estado: string }>>}
   */
  async listarEstadosIntentos(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('intentos_cuestionario')
      .select('cuestionario_id, estado, fecha_inicio')
      .eq('usuario_id', usuarioId)
      .order('fecha_inicio', { ascending: false })
      .limit(200);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Guarda las evaluaciones de las respuestas abiertas de un intento.
   *
   * @param {Array<object>} evaluaciones
   * @returns {Promise<Array<object>>}
   */
  async guardarEvaluaciones(evaluaciones) {
    const { data, error } = await this.requireClient()
      .from('evaluaciones_respuesta')
      .upsert(evaluaciones, { onConflict: 'intento_id,pregunta_id' })
      .select(EVALUACION_COLUMNS);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Devuelve las evaluaciones guardadas de un intento propio.
   *
   * @param {string} usuarioId
   * @param {string} intentoId
   * @returns {Promise<Array<object>>}
   */
  async listarEvaluaciones(usuarioId, intentoId) {
    const intento = await this.obtenerIntentoPorId(usuarioId, intentoId);

    if (!intento) {
      return [];
    }

    const { data, error } = await this.requireClient()
      .from('evaluaciones_respuesta')
      .select(EVALUACION_COLUMNS)
      .eq('intento_id', intentoId);

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

  /**
   * Lista los cuestionarios publicados que el usuario puede resolver. RLS
   * restringe el resultado a las materias con inscripción activa; el filtro
   * explícito por `publicado` evita devolver borradores del docente.
   * La ventana de fechas evita mostrar cuestionarios aún no abiertos o ya
   * cerrados como disponibles para resolver.
   *
   * @param {{ limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarCuestionariosDisponibles({ limit, offset }) {
    const ahora = new Date().toISOString();
    const { data, error, count } = await this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS, { count: 'exact' })
      .eq('publicado', true)
      .lte('fecha_inicio', ahora)
      .gte('fecha_limite', ahora)
      .order('fecha_inicio', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * Lista todos los cuestionarios publicados accesibles para el usuario,
   * incluso los programados o cerrados. Se usa para proyectarlos en Tareas y
   * en el calendario; la resolución sigue sujeta a la ventana de fechas.
   *
   * @param {{
   *   limit: number,
   *   offset: number,
   *   desde?: Date,
   *   hasta?: Date,
   *   materiaId?: string,
   *   query?: string
   * }} filtros
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarCuestionariosPublicados({ limit, offset, desde, hasta, materiaId, query }) {
    let builder = this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS, { count: 'exact' })
      .eq('publicado', true);

    if (desde) {
      builder = builder.gte('fecha_inicio', desde.toISOString());
    }

    if (hasta) {
      builder = builder.lte('fecha_inicio', hasta.toISOString());
    }

    if (materiaId) {
      builder = builder.eq('materia_id', materiaId);
    }

    if (query) {
      const terminoSeguro = String(query).replace(/[,()%]/g, ' ').trim();

      if (terminoSeguro) {
        builder = builder.ilike('titulo', `%${terminoSeguro}%`);
      }
    }

    const { data, error, count } = await builder
      .order('fecha_inicio', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
  }

  /**
   * Devuelve un cuestionario accesible para el usuario: propio, o publicado en
   * una materia donde tiene inscripción activa. Un recurso ajeno se trata como
   * inexistente para no revelar su existencia.
   *
   * @param {string} usuarioId
   * @param {string} cuestionarioId
   * @returns {Promise<object | null>}
   */
  async obtenerCuestionarioAccesiblePorId(usuarioId, cuestionarioId) {
    const { data, error } = await this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS)
      .eq('id', cuestionarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data || data.usuario_id === usuarioId) {
      return data ?? null;
    }

    if (!data.publicado) {
      return null;
    }

    const esEstudianteActivo = await this.usuarioEstudianteActivoEnMateria(
      usuarioId,
      data.materia_id,
    );

    return esEstudianteActivo ? data : null;
  }

  /**
   * Devuelve un cuestionario solo si el usuario es su dueño y el docente
   * responsable de la materia. Se usa para publicar y para consultar
   * calificaciones; un artefacto IA privado de otra persona no se expone.
   *
   * @param {string} usuarioId
   * @param {string} cuestionarioId
   * @returns {Promise<object | null>}
   */
  async obtenerCuestionarioParaDocente(usuarioId, cuestionarioId) {
    const { data, error } = await this.requireClient()
      .from('cuestionarios')
      .select(CUESTIONARIO_COLUMNS)
      .eq('id', cuestionarioId)
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const esDocente = await this.esDocenteResponsable(usuarioId, data.materia_id);
    return esDocente ? data : null;
  }

  /**
   * @param {string} usuarioId
   * @param {string} materiaId
   * @returns {Promise<boolean>}
   */
  async usuarioEstudianteActivoEnMateria(usuarioId, materiaId) {
    const materias = await this.listarMateriasConInscripcionActiva(usuarioId);
    return materias.some((materia) => materia.materia_id === materiaId);
  }

  /**
   * Lista las materias en las que el usuario tiene inscripción activa.
   *
   * @param {string} usuarioId
   * @returns {Promise<Array<object>>}
   */
  async listarMateriasConInscripcionActiva(usuarioId) {
    const { data, error } = await this.requireClient()
      .from('inscripciones')
      .select('id, materia_id, materias ( id, nombre, codigo )')
      .eq('estudiante_id', usuarioId)
      .eq('estado', 'activa')
      .order('fecha_inscripcion', { ascending: false });

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Comprueba que el usuario sea el docente responsable de la materia. Se
   * filtra explícitamente por `docente_id` como defensa en profundidad: un
   * administrador sin esa responsabilidad no puede publicar.
   *
   * @param {string} usuarioId
   * @param {string} materiaId
   * @returns {Promise<boolean>}
   */
  async esDocenteResponsable(usuarioId, materiaId) {
    const { data, error } = await this.requireClient()
      .from('materias')
      .select('id')
      .eq('id', materiaId)
      .eq('docente_id', usuarioId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return Boolean(data);
  }

  /**
   * Publica o despublica un cuestionario propio de una materia concreta. El
   * filtro por `usuario_id` refuerza la política RLS y evita que un docente
   * modifique un cuestionario generado por otra persona. Al publicar se guarda
   * la ventana en la que los estudiantes pueden resolverlo.
   *
   * @param {{
   *   usuarioId: string,
   *   cuestionarioId: string,
   *   materiaId: string,
   *   publicado: boolean,
   *   fechaInicio?: Date | null,
   *   fechaLimite?: Date | null
   * }} datos
   * @returns {Promise<object | null>}
   */
  async actualizarPublicacion({
    usuarioId,
    cuestionarioId,
    materiaId,
    publicado,
    fechaInicio = null,
    fechaLimite = null,
  }) {
    const { data, error } = await this.requireClient()
      .from('cuestionarios')
      .update({
        publicado,
        fecha_publicacion: publicado ? new Date().toISOString() : null,
        fecha_inicio: publicado ? fechaInicio?.toISOString() ?? null : null,
        fecha_limite: publicado ? fechaLimite?.toISOString() ?? null : null,
      })
      .eq('id', cuestionarioId)
      .eq('usuario_id', usuarioId)
      .eq('materia_id', materiaId)
      .select(CUESTIONARIO_COLUMNS)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  /**
   * Lista los intentos finalizados de un cuestionario con la identidad del
   * estudiante. Solo debe invocarse con el cliente service_role y después de
   * verificar que el solicitante es el docente responsable de la materia.
   *
   * @param {{ cuestionarioId: string, limit: number, offset: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listarCalificaciones({ cuestionarioId, limit, offset }) {
    const { data, error, count } = await this.requireClient()
      .from('intentos_cuestionario')
      .select(
        `id, usuario_id, cuestionario_id, estado, total_preguntas, respuestas_correctas,
         puntuacion, fecha_inicio, fecha_finalizacion,
         perfiles ( id, nombre, apellido, correo )`,
        { count: 'exact' },
      )
      .eq('cuestionario_id', cuestionarioId)
      .eq('estado', 'finalizado')
      .order('fecha_finalizacion', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw error;
    }

    return { items: data ?? [], total: count ?? 0 };
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
module.exports.INTENTO_COLUMNS = INTENTO_COLUMNS;
