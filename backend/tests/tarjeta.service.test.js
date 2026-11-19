const TarjetaService = require('../src/services/tarjeta.service');
const { TarjetaIaError } = require('../src/services/ia/tarjeta.ia.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const CONJUNTO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const TARJETA_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';

const TARJETAS_IA = [
  { frente: '¿Qué mide la derivada?', reverso: 'La tasa de cambio instantánea.' },
  { frente: 'Regla de la cadena', reverso: 'Deriva la exterior por la interior.' },
  { frente: '¿Qué es una función continua?', reverso: 'Una función sin cortes ni saltos.' },
];

const FILA_CONJUNTO = {
  id: CONJUNTO_ID,
  usuario_id: USUARIO_ID,
  materia_id: MATERIA_ID,
  documento_id: DOCUMENTO_ID,
  titulo: 'Tarjetas de cálculo',
  cantidad_tarjetas: 3,
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 300,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  materias: { nombre: 'Cálculo Diferencial', codigo: 'MAT-101', color: '#3B82F6' },
};

const FILAS_TARJETAS = TARJETAS_IA.map((tarjeta, indice) => ({
  id: `${TARJETA_ID.slice(0, 8)}-0000-4000-8000-${String(indice + 1).padStart(12, '0')}`,
  usuario_id: USUARIO_ID,
  conjunto_id: CONJUNTO_ID,
  orden: indice + 1,
  frente: tarjeta.frente,
  reverso: tarjeta.reverso,
  estado: 'sin_revisar',
  fecha_actualizacion: '2026-11-19T10:00:00.000Z',
}));

/**
 * @param {object} [opciones]
 * @returns {{ servicio: TarjetaService, dependencias: object }}
 */
function crearServicio({
  materia = { id: MATERIA_ID, nombre: 'Cálculo Diferencial' },
  documento = {
    id: DOCUMENTO_ID,
    materia_id: MATERIA_ID,
    nombre: 'Apuntes',
    estado_procesamiento: 'procesado',
  },
  fragmentosDocumento = [{ numero_pagina: 1, contenido: 'x'.repeat(200) }],
  fragmentosMateria = [{ numero_pagina: 1, contenido: 'x'.repeat(200) }],
  consumo = 0,
  errorIa = null,
  conjunto = FILA_CONJUNTO,
  tarjetas = FILAS_TARJETAS,
  tarjeta = FILAS_TARJETAS[0],
  conteos = [
    { conjunto_id: CONJUNTO_ID, estado: 'conocida' },
    { conjunto_id: CONJUNTO_ID, estado: 'repaso' },
    { conjunto_id: CONJUNTO_ID, estado: 'sin_revisar' },
  ],
} = {}) {
  const dependencias = {
    materiaRepository: {
      obtenerMateriaPorId: jest.fn().mockResolvedValue(materia),
    },
    documentoRepository: {
      obtenerDocumentoPorId: jest.fn().mockResolvedValue(documento),
    },
    fragmentoRepository: {
      listarParaCuestionario: jest.fn().mockResolvedValue(fragmentosDocumento),
      listarPorMateriaParaCuestionario: jest.fn().mockResolvedValue(fragmentosMateria),
    },
    tarjetaRepository: {
      crearConjunto: jest.fn().mockImplementation(async (cabecera, generadas) => ({
        ...cabecera,
        ...FILA_CONJUNTO,
        cantidad_tarjetas: generadas.length,
        tarjetas: generadas.map((generada, indice) => ({
          ...FILAS_TARJETAS[indice],
          frente: generada.frente,
          reverso: generada.reverso,
        })),
      })),
      listarConjuntos: jest.fn().mockResolvedValue({ items: [conjunto], total: 1 }),
      obtenerConjuntoPorId: jest.fn().mockResolvedValue(conjunto),
      listarTarjetas: jest.fn().mockResolvedValue(tarjetas),
      contarEstados: jest.fn().mockResolvedValue(conteos),
      eliminarConjunto: jest.fn().mockResolvedValue(undefined),
      obtenerTarjetaPorId: jest.fn().mockResolvedValue(tarjeta),
      actualizarEstado: jest.fn().mockImplementation(async (_usuarioId, _tarjetaId, estado) => ({
        ...FILAS_TARJETAS[0],
        estado,
      })),
    },
    consumoRepository: {
      contar: jest.fn().mockResolvedValue(consumo),
      registrar: jest.fn().mockResolvedValue(undefined),
    },
    iaService: {
      generarTarjetas: jest.fn().mockImplementation(async () => {
        if (errorIa) {
          throw errorIa;
        }

        return {
          contenido: { titulo: 'Tarjetas de cálculo', tarjetas: TARJETAS_IA },
          modelo: 'gemini-3.5-flash-lite',
          tokensEntrada: 500,
          tokensSalida: 300,
        };
      }),
    },
    usuarioActualId: USUARIO_ID,
  };

  return { servicio: new TarjetaService(dependencias), dependencias };
}

describe('TarjetaService (HU14)', () => {
  it('genera un conjunto con tarjetas sin revisar y registra el consumo', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.generar({
      materiaId: MATERIA_ID,
      documentoId: DOCUMENTO_ID,
      cantidadTarjetas: 3,
    });

    expect(resultado.tarjetas).toHaveLength(3);
    expect(resultado.tarjetas[0]).toEqual(
      expect.objectContaining({ estado: 'sin_revisar', frente: TARJETAS_IA[0].frente }),
    );
    expect(resultado.cantidad_conocidas).toBe(0);
    expect(resultado.cantidad_pendientes).toBe(3);
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'tarjeta', usuario_id: USUARIO_ID }),
    );
  });

  it('usa los fragmentos de la materia cuando no se elige documento', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 });

    expect(dependencias.documentoRepository.obtenerDocumentoPorId).not.toHaveBeenCalled();
    expect(
      dependencias.fragmentoRepository.listarPorMateriaParaCuestionario,
    ).toHaveBeenCalledWith(MATERIA_ID, 60);
  });

  it('rechaza una materia ajena con 404', async () => {
    const { servicio, dependencias } = crearServicio({ materia: null });

    await expect(
      servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(dependencias.iaService.generarTarjetas).not.toHaveBeenCalled();
  });

  it('rechaza un documento ajeno o de otra materia con 404', async () => {
    const ajeno = crearServicio({ documento: null });
    await expect(
      ajeno.servicio.generar({
        materiaId: MATERIA_ID,
        documentoId: DOCUMENTO_ID,
        cantidadTarjetas: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });

    const otraMateria = crearServicio({
      documento: { id: DOCUMENTO_ID, materia_id: 'otra-materia', estado_procesamiento: 'procesado' },
    });
    await expect(
      otraMateria.servicio.generar({
        materiaId: MATERIA_ID,
        documentoId: DOCUMENTO_ID,
        cantidadTarjetas: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
  });

  it('rechaza un documento sin procesar con 422', async () => {
    const { servicio } = crearServicio({
      documento: {
        id: DOCUMENTO_ID,
        materia_id: MATERIA_ID,
        estado_procesamiento: 'pendiente',
      },
    });

    await expect(
      servicio.generar({
        materiaId: MATERIA_ID,
        documentoId: DOCUMENTO_ID,
        cantidadTarjetas: 3,
      }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza una materia sin material procesado con 422', async () => {
    const { servicio } = crearServicio({ fragmentosMateria: [] });

    await expect(
      servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('rechaza una generacion sin contenido suficiente con 422', async () => {
    const { servicio } = crearServicio({ fragmentosMateria: [{ contenido: 'corto' }] });

    await expect(
      servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 }),
    ).rejects.toMatchObject({ statusCode: 422 });
  });

  it('aplica la cuota diaria antes de llamar a la IA', async () => {
    const { servicio, dependencias } = crearServicio({ consumo: 10 });

    await expect(
      servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 }),
    ).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
    expect(dependencias.iaService.generarTarjetas).not.toHaveBeenCalled();
  });

  it('traduce un fallo del proveedor a 503 sin detalles internos', async () => {
    const { servicio } = crearServicio({
      errorIa: new TarjetaIaError('El proveedor fallo con un stack interno.'),
    });

    await expect(
      servicio.generar({ materiaId: MATERIA_ID, documentoId: null, cantidadTarjetas: 3 }),
    ).rejects.toMatchObject({ statusCode: 503, message: 'El proveedor fallo con un stack interno.' });
  });

  it('lista los conjuntos con el avance de estudio agregado', async () => {
    const { servicio } = crearServicio();

    const { items, total } = await servicio.listar({ limite: 20, desplazamiento: 0 });

    expect(total).toBe(1);
    expect(items[0]).toEqual(
      expect.objectContaining({
        cantidad_tarjetas: 3,
        cantidad_conocidas: 1,
        cantidad_pendientes: 2,
      }),
    );
  });

  it('filtra las tarjetas conocidas al pedir solo pendientes', async () => {
    const pendientes = [FILAS_TARJETAS[1]];
    const { servicio, dependencias } = crearServicio({ tarjetas: pendientes });

    const resultado = await servicio.obtener(CONJUNTO_ID, { estado: 'pendientes' });

    expect(resultado.tarjetas).toEqual([
      expect.objectContaining({
        id: FILAS_TARJETAS[1].id,
        frente: FILAS_TARJETAS[1].frente,
        estado: 'sin_revisar',
      }),
    ]);
    expect(resultado.cantidad_conocidas).toBe(1);
    expect(dependencias.tarjetaRepository.listarTarjetas).toHaveBeenCalledWith(CONJUNTO_ID, {
      soloPendientes: true,
    });
  });

  it('devuelve 404 para un conjunto ajeno', async () => {
    const { servicio } = crearServicio({ conjunto: null });

    await expect(servicio.obtener(CONJUNTO_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('actualiza el estado de una tarjeta propia', async () => {
    const { servicio, dependencias } = crearServicio();

    const actualizada = await servicio.actualizarEstado(TARJETA_ID, 'repaso');

    expect(actualizada.estado).toBe('repaso');
    expect(dependencias.tarjetaRepository.actualizarEstado).toHaveBeenCalledWith(
      USUARIO_ID,
      TARJETA_ID,
      'repaso',
    );
  });

  it('devuelve 404 al marcar una tarjeta ajena', async () => {
    const { servicio, dependencias } = crearServicio({ tarjeta: null });

    await expect(servicio.actualizarEstado(TARJETA_ID, 'conocida')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(dependencias.tarjetaRepository.actualizarEstado).not.toHaveBeenCalled();
  });

  it('elimina un conjunto propio', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.eliminar(CONJUNTO_ID);

    expect(dependencias.tarjetaRepository.eliminarConjunto).toHaveBeenCalledWith(
      USUARIO_ID,
      CONJUNTO_ID,
    );
  });
});
