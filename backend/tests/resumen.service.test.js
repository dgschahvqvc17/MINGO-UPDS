const ResumenService = require('../src/services/resumen.service');
const ApiError = require('../src/utils/ApiError');
const { ResumenIaError } = require('../src/services/ia/resumen.ia.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const HASH_CONTENIDO = 'b'.repeat(64);

const CONTENIDO_IA = {
  resumen_general: 'Este documento explica los conceptos fundamentales del tema y sus aplicaciones.',
  temas_principales: ['Conceptos basicos', 'Aplicaciones'],
  conceptos_importantes: [
    { termino: 'Concepto', descripcion: 'Idea central que estructura el tema.' },
  ],
};

function crearFragmentos(contenido = 'Contenido del fragmento con informacion suficiente para resumir.') {
  return [
    {
      numero_fragmento: 1,
      numero_pagina: 1,
      contenido,
      hash_contenido: HASH_CONTENIDO,
    },
  ];
}

function crearDependencias({
  estado = 'procesado',
  fragmentos = crearFragmentos(),
  cache = null,
  consumo = 0,
  resumenGuardado = null,
} = {}) {
  const dependencias = {
    documentoRepository: {
      obtenerDocumentoPorId: jest.fn().mockResolvedValue({
        id: DOCUMENTO_ID,
        nombre: 'Apuntes de calculo',
        estado_procesamiento: estado,
      }),
    },
    fragmentoRepository: {
      listarParaResumen: jest.fn().mockResolvedValue(fragmentos),
    },
    resumenRepository: {
      obtenerPorClave: jest.fn().mockResolvedValue(cache),
      obtenerUltimo: jest.fn().mockResolvedValue(resumenGuardado),
      guardar: jest.fn().mockImplementation(async (fila) => ({
        ...fila,
        id: 'resumen-id',
        fecha_creacion: '2026-11-18T10:00:00.000Z',
      })),
    },
    consumoRepository: {
      contar: jest.fn().mockResolvedValue(consumo),
      registrar: jest.fn().mockResolvedValue('consumo-id'),
    },
    iaService: {
      generarResumen: jest.fn().mockResolvedValue({
        contenido: CONTENIDO_IA,
        modelo: 'gpt-4o-mini',
        tokensEntrada: 100,
        tokensSalida: 50,
      }),
    },
    usuarioActualId: USUARIO_ID,
  };

  dependencias.service = new ResumenService(dependencias);
  return dependencias;
}

describe('ResumenService (HU10)', () => {
  const entrada = { documentoId: DOCUMENTO_ID, profundidad: 'media', guardar: true };

  it('rechaza un documento ajeno o inexistente con 404', async () => {
    const dependencias = crearDependencias();
    dependencias.documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

    await expect(dependencias.service.generar(entrada)).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(dependencias.fragmentoRepository.listarParaResumen).not.toHaveBeenCalled();
  });

  it('rechaza con 422 un documento que todavia no esta procesado', async () => {
    const dependencias = crearDependencias({ estado: 'pendiente' });

    await expect(dependencias.service.generar(entrada)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(dependencias.iaService.generarResumen).not.toHaveBeenCalled();
  });

  it('rechaza con 422 un documento sin contenido procesado', async () => {
    const dependencias = crearDependencias({ fragmentos: [] });

    await expect(dependencias.service.generar(entrada)).rejects.toMatchObject({
      statusCode: 422,
    });
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('reutiliza el resumen cacheado sin llamar a la IA', async () => {
    const cache = {
      ...CONTENIDO_IA,
      id: 'resumen-cache',
      documento_id: DOCUMENTO_ID,
      profundidad: 'media',
      modelo: 'gpt-4o-mini',
      tokens_entrada: 100,
      tokens_salida: 50,
      contenido_truncado: false,
      fecha_creacion: '2026-11-17T10:00:00.000Z',
    };
    const dependencias = crearDependencias({ cache });

    const resultado = await dependencias.service.generar(entrada);

    expect(resultado.reutilizado).toBe(true);
    expect(resultado.id).toBe('resumen-cache');
    expect(dependencias.iaService.generarResumen).not.toHaveBeenCalled();
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('rechaza con 429 y codigo AI_QUOTA_EXCEEDED al agotar la cuota diaria', async () => {
    const dependencias = crearDependencias({ consumo: 20 });

    await expect(dependencias.service.generar(entrada)).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
    expect(dependencias.iaService.generarResumen).not.toHaveBeenCalled();
  });

  it('genera, registra consumo y guarda el resumen', async () => {
    const dependencias = crearDependencias();

    const resultado = await dependencias.service.generar(entrada);

    expect(dependencias.resumenRepository.guardar).toHaveBeenCalledWith(
      expect.objectContaining({
        usuario_id: USUARIO_ID,
        documento_id: DOCUMENTO_ID,
        profundidad: 'media',
        hash_contenido: expect.stringMatching(/^[0-9a-f]{64}$/),
        resumen_general: CONTENIDO_IA.resumen_general,
        contenido_truncado: false,
      }),
    );
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ operacion: 'resumen', tokens_entrada: 100, tokens_salida: 50 }),
    );
    expect(resultado).toMatchObject({
      guardado: true,
      reutilizado: false,
      id: 'resumen-id',
      documento_nombre: 'Apuntes de calculo',
      temas_principales: CONTENIDO_IA.temas_principales,
    });
  });

  it('devuelve el resumen sin persistirlo cuando guardar es false', async () => {
    const dependencias = crearDependencias();

    const resultado = await dependencias.service.generar({
      ...entrada,
      guardar: false,
    });

    expect(dependencias.resumenRepository.guardar).not.toHaveBeenCalled();
    expect(resultado.guardado).toBe(false);
    expect(resultado.id).toBeNull();
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('marca el contenido como truncado cuando supera el limite de tokens', async () => {
    const textoLargo = 'x'.repeat(ResumenService.MAXIMO_CARACTERES_CONTENIDO + 1);
    const dependencias = crearDependencias({ fragmentos: crearFragmentos(textoLargo) });

    const resultado = await dependencias.service.generar(entrada);

    expect(resultado.contenido_truncado).toBe(true);
  });

  it('traduce un error del proveedor a 503 con mensaje seguro', async () => {
    const dependencias = crearDependencias();
    dependencias.iaService.generarResumen.mockRejectedValue(
      new ResumenIaError('El proveedor de IA no respondio a tiempo.'),
    );

    await expect(dependencias.service.generar(entrada)).rejects.toMatchObject({
      statusCode: 503,
      message: 'El proveedor de IA no respondio a tiempo.',
    });
    expect(dependencias.consumoRepository.registrar).not.toHaveBeenCalled();
  });

  it('recupera el ultimo resumen guardado del documento', async () => {
    const resumenGuardado = {
      ...CONTENIDO_IA,
      id: 'resumen-id',
      documento_id: DOCUMENTO_ID,
      profundidad: 'media',
      modelo: 'gpt-4o-mini',
      tokens_entrada: 100,
      tokens_salida: 50,
      contenido_truncado: false,
      fecha_creacion: '2026-11-18T10:00:00.000Z',
    };
    const dependencias = crearDependencias({ resumenGuardado });

    const resultado = await dependencias.service.obtenerGuardado(DOCUMENTO_ID);

    expect(resultado).toMatchObject({
      id: 'resumen-id',
      guardado: true,
      reutilizado: false,
      documento_nombre: 'Apuntes de calculo',
    });
  });

  it('devuelve null cuando el documento no tiene resumen guardado', async () => {
    const dependencias = crearDependencias();

    await expect(dependencias.service.obtenerGuardado(DOCUMENTO_ID)).resolves.toBeNull();
  });

  it('no revela resumenes de documentos ajenos en la reconsulta', async () => {
    const dependencias = crearDependencias();
    dependencias.documentoRepository.obtenerDocumentoPorId.mockResolvedValue(null);

    await expect(dependencias.service.obtenerGuardado(DOCUMENTO_ID)).rejects.toBeInstanceOf(
      ApiError,
    );
    expect(dependencias.resumenRepository.obtenerUltimo).not.toHaveBeenCalled();
  });
});
