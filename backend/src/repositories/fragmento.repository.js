/**
 * Acceso a datos de los fragmentos de documento (HU09).
 * Lo usa el worker con service_role; la API solo lee mediante RLS.
 * No conoce HTTP ni reglas de negocio.
 */

/**
 * Filas por insercion. Cada fila lleva un embedding de 1536 flotantes
 * (~30 kB de JSON), asi que un lote grande se acerca al limite de cuerpo de
 * PostgREST; con 10 filas cada peticion ronda los 300 kB.
 */
const TAMANO_LOTE = 10;

/**
 * Desplazamiento aplicado en la primera insercion. Evita chocar con la
 * restriccion `unique (documento_id, numero_fragmento)` mientras conviven los
 * fragmentos anteriores y los nuevos. Es mucho mayor que el maximo de
 * fragmentos por documento (1500).
 */
const DESPLAZAMIENTO = 1_000_000_000;

/** Codigo de PostgREST cuando la funcion RPC no existe en la base de datos. */
const CODIGO_RPC_INEXISTENTE = 'PGRST202';

class FragmentoRepository {
  /**
   * @param {{
   *   supabase: import('@supabase/supabase-js').SupabaseClient | null,
   *   logger?: Pick<Console, 'error'>
   * }} dependencies
   */
  constructor({ supabase, logger = console }) {
    this.supabase = supabase;
    this.logger = logger;
  }

  /**
   * Reemplaza todos los fragmentos de un documento de forma atomica.
   *
   * Los fragmentos nuevos se insertan con `numero_fragmento + DESPLAZAMIENTO`
   * por lotes y despues la funcion `confirmar_reemplazo_fragmentos` borra los
   * anteriores y resta el desplazamiento en una sola transaccion. Asi un fallo
   * a mitad de camino no deja el documento sin contenido ni mezcla versiones.
   *
   * @param {string} documentoId UUID del documento.
   * @param {Array<{ numero_fragmento: number, numero_pagina: number | null, contenido: string, hash_contenido: string, embedding: number[] }>} fragmentos
   * @param {{ modeloEmbedding: string }} opciones
   * @returns {Promise<number>} Cantidad de fragmentos guardados.
   */
  async reemplazarFragmentos(documentoId, fragmentos, { modeloEmbedding }) {
    if (!Array.isArray(fragmentos) || fragmentos.length === 0) {
      throw new Error('No hay fragmentos para guardar.');
    }

    // Limpia restos de un intento anterior que no llego a confirmarse.
    await this.eliminarPendientes(documentoId);

    try {
      for (let inicio = 0; inicio < fragmentos.length; inicio += TAMANO_LOTE) {
        const lote = fragmentos
          .slice(inicio, inicio + TAMANO_LOTE)
          .map((fragmento) => ({
            documento_id: documentoId,
            numero_fragmento: fragmento.numero_fragmento + DESPLAZAMIENTO,
            numero_pagina: fragmento.numero_pagina,
            contenido: fragmento.contenido,
            hash_contenido: fragmento.hash_contenido,
            embedding: fragmento.embedding,
            modelo_embedding: modeloEmbedding,
          }));

        const { error } = await this.requireClient().from('fragmentos_documento').insert(lote);

        if (error) {
          throw error;
        }
      }

      await this.confirmarReemplazo(documentoId);
    } catch (error) {
      // Un fallo deja los fragmentos nuevos fuera de la numeracion definitiva;
      // se retiran para que el siguiente intento parta de un estado limpio.
      await this.eliminarPendientes(documentoId).catch((errorLimpieza) => {
        this.loggerLimpieza(errorLimpieza, documentoId);
      });
      throw error;
    }

    return fragmentos.length;
  }

  /**
   * Confirma el reemplazo: borra los fragmentos anteriores y renumera los nuevos.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<void>}
   */
  async confirmarReemplazo(documentoId) {
    const { error } = await this.requireClient().rpc('confirmar_reemplazo_fragmentos', {
      p_documento_id: documentoId,
      p_desplazamiento: DESPLAZAMIENTO,
    });

    if (error) {
      if (error.code === CODIGO_RPC_INEXISTENTE) {
        throw new Error(
          'Falta la funcion public.confirmar_reemplazo_fragmentos. Ejecuta supabase/migrations/0006_hu09_reemplazo_fragmentos.sql.',
        );
      }

      throw error;
    }
  }

  /**
   * Elimina los fragmentos insertados con desplazamiento que no se confirmaron.
   * Nunca toca los fragmentos vigentes del documento.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<void>}
   */
  async eliminarPendientes(documentoId) {
    const { error } = await this.requireClient()
      .from('fragmentos_documento')
      .delete()
      .eq('documento_id', documentoId)
      .gt('numero_fragmento', DESPLAZAMIENTO);

    if (error) {
      throw error;
    }
  }

  /**
   * Lista el contenido de un documento para generar su resumen (HU10).
   * Se lee con el cliente del usuario: RLS garantiza que sea su documento.
   *
   * @param {string} documentoId UUID del documento.
   * @param {number} limite Maximo de fragmentos a recuperar.
   * @returns {Promise<Array<{ numero_fragmento: number, numero_pagina: number | null, contenido: string, hash_contenido: string }>>}
   */
  async listarParaResumen(documentoId, limite) {
    const { data, error } = await this.requireClient()
      .from('fragmentos_documento')
      .select('numero_fragmento, numero_pagina, contenido, hash_contenido')
      .eq('documento_id', documentoId)
      .order('numero_fragmento', { ascending: true })
      .limit(limite);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Lista el contenido de un documento para generar un cuestionario (HU13).
   * Se lee con el cliente del usuario: RLS garantiza que sea su documento.
   *
   * @param {string} documentoId UUID del documento.
   * @param {number} limite Maximo de fragmentos a recuperar.
   * @returns {Promise<Array<{ id: string, numero_fragmento: number, numero_pagina: number | null, contenido: string }>>}
   */
  async listarParaCuestionario(documentoId, limite) {
    const { data, error } = await this.requireClient()
      .from('fragmentos_documento')
      .select('id, numero_fragmento, numero_pagina, contenido')
      .eq('documento_id', documentoId)
      .order('numero_fragmento', { ascending: true })
      .limit(limite);

    if (error) {
      throw error;
    }

    return data ?? [];
  }

  /**
   * Lista el contenido de todos los documentos procesados de una materia para
   * generar un cuestionario sin elegir un documento concreto (HU13).
   * Se lee con el cliente del usuario: RLS garantiza que sean documentos suyos.
   *
   * @param {string} materiaId UUID de la materia.
   * @param {number} limite Maximo de fragmentos a recuperar.
   * @returns {Promise<Array<{ numero_fragmento: number, numero_pagina: number | null, contenido: string }>>}
   */
  async listarPorMateriaParaCuestionario(materiaId, limite) {
    const { data, error } = await this.requireClient()
      .from('fragmentos_documento')
      .select('numero_fragmento, numero_pagina, contenido, documentos!inner(materia_id, estado_procesamiento)')
      .eq('documentos.materia_id', materiaId)
      .eq('documentos.estado_procesamiento', 'procesado')
      .order('numero_fragmento', { ascending: true })
      .limit(limite);

    if (error) {
      throw error;
    }

    return (data ?? []).map((fragmento) => ({
      numero_fragmento: fragmento.numero_fragmento,
      numero_pagina: fragmento.numero_pagina,
      contenido: fragmento.contenido,
    }));
  }

  /**
   * Recupera los fragmentos mas similares a un vector de consulta (HU11).
   * La funcion RPC filtra por propietario con `auth.uid()`, ademas de aplicar
   * RLS. Nunca se busca sin ese filtro.
   *
   * @param {number[]} embedding Vector de la consulta.
   * @param {{ limite: number, umbral: number, documentoId?: string | null, materiaId?: string | null }} opciones
   * @returns {Promise<Array<object>>}
   */
  async buscarSimilares(
    embedding,
    { limite, umbral, documentoId = null, materiaId = null },
  ) {
    const { data, error } = await this.requireClient().rpc('match_fragmentos', {
      query_embedding: embedding,
      match_threshold: umbral,
      match_count: limite,
      p_documento_id: documentoId,
      p_materia_id: materiaId,
    });

    if (error) {
      if (error.code === CODIGO_RPC_INEXISTENTE) {
        throw new Error(
          'Falta la funcion public.match_fragmentos. Ejecuta supabase/migrations/0008_hu11_busqueda_semantica.sql.',
        );
      }

      throw error;
    }

    return data ?? [];
  }

  /**
   * @param {unknown} error
   * @param {string} documentoId
   * @returns {void}
   */
  loggerLimpieza(error, documentoId) {
    this.logger.error('No se pudieron limpiar los fragmentos pendientes.', {
      documentoId,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = FragmentoRepository;
module.exports.TAMANO_LOTE = TAMANO_LOTE;
module.exports.DESPLAZAMIENTO = DESPLAZAMIENTO;
