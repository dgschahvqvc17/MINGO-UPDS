/**
 * Acceso a datos de los fragmentos de documento (HU09).
 * Lo usa el worker con service_role; la API solo lee mediante RLS.
 * No conoce HTTP ni reglas de negocio.
 */
const TAMANO_LOTE = 25;

class FragmentoRepository {
  /**
   * @param {{ supabase: import('@supabase/supabase-js').SupabaseClient | null }} dependencies
   */
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  /**
   * Reemplaza todos los fragmentos de un documento.
   * Se ejecuta en dos pasos para que un reproceso no mezcle fragmentos viejos
   * con nuevos; si la insercion falla, el documento queda marcado como error.
   *
   * @param {string} documentoId UUID del documento.
   * @param {Array<{ numero_fragmento: number, numero_pagina: number | null, contenido: string, hash_contenido: string, embedding: number[] }>} fragmentos
   * @param {{ modeloEmbedding: string }} opciones
   * @returns {Promise<number>} Cantidad de fragmentos guardados.
   */
  async reemplazarFragmentos(documentoId, fragmentos, { modeloEmbedding }) {
    await this.eliminarPorDocumento(documentoId);

    for (let inicio = 0; inicio < fragmentos.length; inicio += TAMANO_LOTE) {
      const lote = fragmentos.slice(inicio, inicio + TAMANO_LOTE).map((fragmento) => ({
        documento_id: documentoId,
        numero_fragmento: fragmento.numero_fragmento,
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

    return fragmentos.length;
  }

  /**
   * Elimina los fragmentos de un documento.
   *
   * @param {string} documentoId UUID del documento.
   * @returns {Promise<void>}
   */
  async eliminarPorDocumento(documentoId) {
    const { error } = await this.requireClient()
      .from('fragmentos_documento')
      .delete()
      .eq('documento_id', documentoId);

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

module.exports = FragmentoRepository;
module.exports.TAMANO_LOTE = TAMANO_LOTE;
