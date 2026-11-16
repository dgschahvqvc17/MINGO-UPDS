const { describe, it, expect, jest: j } = require('@jest/globals');
const FragmentoRepository = require('../src/repositories/fragmento.repository');

const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const DESPLAZAMIENTO = 1_000_000_000;

/**
 * Cliente de Supabase simulado que registra las llamadas del repositorio.
 *
 * @param {{
 *   insertError?: object | null,
 *   deleteError?: object | null,
 *   deleteErrors?: Array<object | null> | null,
 *   rpcError?: object | null,
 *   onInsert?: (filas: object[]) => void
 * }} [opciones]
 * @returns {{ cliente: object, llamadas: object }}
 */
function crearCliente({
  insertError = null,
  deleteError = null,
  deleteErrors = null,
  rpcError = null,
  onInsert,
} = {}) {
  const llamadas = { inserts: [], deletes: [], rpc: [] };

  const cliente = {
    from(tabla) {
      return {
        insert(filas) {
          llamadas.inserts.push({ tabla, filas });
          if (onInsert) {
            onInsert(filas);
          }
          return Promise.resolve({ error: insertError });
        },
        delete() {
          const filtro = {
            eq(columna, valor) {
              filtro.filtros.push({ tipo: 'eq', columna, valor });
              return filtro;
            },
            gt(columna, valor) {
              filtro.filtros.push({ tipo: 'gt', columna, valor });
              llamadas.deletes.push({ tabla, filtros: filtro.filtros });
              const error = deleteErrors ? deleteErrors.shift() ?? null : deleteError;
              return Promise.resolve({ error });
            },
            filtros: [],
          };

          return filtro;
        },
      };
    },
    rpc(nombre, argumentos) {
      llamadas.rpc.push({ nombre, argumentos });
      return Promise.resolve({ error: rpcError });
    },
  };

  return { cliente, llamadas };
}

/**
 * @param {number} cantidad
 * @returns {Array<object>}
 */
function crearFragmentos(cantidad) {
  return Array.from({ length: cantidad }, (_, indice) => ({
    numero_fragmento: indice + 1,
    numero_pagina: indice + 1,
    contenido: `Contenido del fragmento ${indice + 1}.`,
    hash_contenido: 'a'.repeat(64),
    embedding: [0.01, 0.02, 0.03],
  }));
}

describe('FragmentoRepository', () => {
  it('inserta en lotes con desplazamiento y confirma el reemplazo', async () => {
    const { cliente, llamadas } = crearCliente();
    const repository = new FragmentoRepository({ supabase: cliente });

    const guardados = await repository.reemplazarFragmentos(
      DOCUMENTO_ID,
      crearFragmentos(11),
      { modeloEmbedding: 'text-embedding-3-small' },
    );

    expect(guardados).toBe(11);
    expect(llamadas.inserts).toHaveLength(2);
    expect(llamadas.inserts[0].tabla).toBe('fragmentos_documento');
    expect(llamadas.inserts[0].filas).toHaveLength(10);
    expect(llamadas.inserts[1].filas).toHaveLength(1);
    expect(llamadas.inserts[0].filas[0]).toEqual(
      expect.objectContaining({
        documento_id: DOCUMENTO_ID,
        numero_fragmento: 1 + DESPLAZAMIENTO,
        modelo_embedding: 'text-embedding-3-small',
      }),
    );
    expect(llamadas.inserts[1].filas[0].numero_fragmento).toBe(11 + DESPLAZAMIENTO);
    expect(llamadas.rpc).toEqual([
      {
        nombre: 'confirmar_reemplazo_fragmentos',
        argumentos: {
          p_documento_id: DOCUMENTO_ID,
          p_desplazamiento: DESPLAZAMIENTO,
        },
      },
    ]);
  });

  it('limpia los pendientes antes de insertar para partir de un estado limpio', async () => {
    const { cliente, llamadas } = crearCliente();
    const repository = new FragmentoRepository({ supabase: cliente });

    await repository.reemplazarFragmentos(DOCUMENTO_ID, crearFragmentos(1), {
      modeloEmbedding: 'text-embedding-3-small',
    });

    expect(llamadas.deletes).toHaveLength(1);
    expect(llamadas.deletes[0].filtros).toEqual([
      { tipo: 'eq', columna: 'documento_id', valor: DOCUMENTO_ID },
      { tipo: 'gt', columna: 'numero_fragmento', valor: DESPLAZAMIENTO },
    ]);
    expect(llamadas.rpc).toHaveLength(1);
  });

  it('no confirma el reemplazo y limpia los pendientes cuando falla una inserción', async () => {
    const { cliente, llamadas } = crearCliente({
      insertError: { message: 'timeout', code: 'ETIMEDOUT' },
    });
    const repository = new FragmentoRepository({ supabase: cliente });

    await expect(
      repository.reemplazarFragmentos(DOCUMENTO_ID, crearFragmentos(3), {
        modeloEmbedding: 'text-embedding-3-small',
      }),
    ).rejects.toMatchObject({ code: 'ETIMEDOUT' });

    expect(llamadas.rpc).toHaveLength(0);
    // Una limpieza inicial y otra tras el fallo.
    expect(llamadas.deletes).toHaveLength(2);
  });

  it('avisa de la migración faltante cuando la función RPC no existe', async () => {
    const { cliente } = crearCliente({
      rpcError: { code: 'PGRST202', message: 'Could not find the function' },
    });
    const repository = new FragmentoRepository({ supabase: cliente });

    await expect(
      repository.reemplazarFragmentos(DOCUMENTO_ID, crearFragmentos(1), {
        modeloEmbedding: 'text-embedding-3-small',
      }),
    ).rejects.toThrow(/0006_hu09_reemplazo_fragmentos\.sql/);
  });

  it('registra el fallo de limpieza sin ocultar el error original', async () => {
    const { cliente } = crearCliente({
      insertError: { message: 'fallo de insercion' },
      deleteErrors: [null, { message: 'fallo de limpieza' }],
    });
    const logger = { error: j.fn() };
    const repository = new FragmentoRepository({ supabase: cliente, logger });

    await expect(
      repository.reemplazarFragmentos(DOCUMENTO_ID, crearFragmentos(1), {
        modeloEmbedding: 'text-embedding-3-small',
      }),
    ).rejects.toMatchObject({ message: 'fallo de insercion' });

    expect(logger.error).toHaveBeenCalledWith(
      'No se pudieron limpiar los fragmentos pendientes.',
      expect.objectContaining({ documentoId: DOCUMENTO_ID }),
    );
  });

  it('rechaza una lista vacía de fragmentos', async () => {
    const { cliente, llamadas } = crearCliente();
    const repository = new FragmentoRepository({ supabase: cliente });

    await expect(
      repository.reemplazarFragmentos(DOCUMENTO_ID, [], { modeloEmbedding: 'x' }),
    ).rejects.toThrow(/No hay fragmentos/);

    expect(llamadas.inserts).toHaveLength(0);
    expect(llamadas.rpc).toHaveLength(0);
  });

  it('falla de forma clara si Supabase no está configurado', async () => {
    const repository = new FragmentoRepository({ supabase: null });

    await expect(
      repository.eliminarPendientes(DOCUMENTO_ID),
    ).rejects.toThrow(/Supabase no esta configurado/);
  });
});
