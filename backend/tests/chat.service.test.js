const ChatService = require('../src/services/chat.service');
const {
  UMBRAL_SIMILITUD,
  MENSAJE_SIN_INFORMACION,
  LIMITE_CHAT_POR_HORA,
  LIMITE_CHAT_POR_DIA,
  seleccionarFragmentos,
} = ChatService;
const { TOP_K_BUSQUEDA } = require('../src/models/documento.model');
const { ErrorProcesamiento } = require('../src/services/procesamiento/procesamiento.error');
const { AgenteIaError } = require('../src/services/ia/agente.service');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const FRAGMENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const EMBEDDING = Array.from({ length: 1536 }, (_, indice) => indice / 1536);

const FILA = {
  id: FRAGMENTO_ID,
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de cálculo',
  numero_fragmento: 3,
  numero_pagina: 12,
  contenido: 'La derivada mide la tasa de cambio instantánea.',
  similitud: 0.873421,
  modelo_embedding: 'gemini-embedding-001',
};

/**
 * @param {object} [opciones]
 * @returns {{ servicio: ChatService, dependencias: object }}
 */
function crearServicio({
  fragmentos = [FILA],
  consumos = [0, 0],
  conversacion = null,
  documento = { id: DOCUMENTO_ID, estado_procesamiento: 'procesado' },
  embeddingError = null,
  respuestaError = null,
} = {}) {
  const dependencias = {
    conversacionRepository: {
      obtenerPorId: jest.fn().mockResolvedValue(conversacion),
      crear: jest.fn().mockResolvedValue({
        id: 'conversacion-nueva',
        usuario_id: USUARIO_ID,
        titulo: 'Nueva conversación',
        tipo_conversacion: 'academica',
      }),
      obtenerHistorialReciente: jest.fn().mockResolvedValue([]),
      guardarMensajes: jest.fn().mockImplementation((mensajes) =>
        Promise.resolve(
          mensajes.map((mensaje, indice) => ({ id: `mensaje-${indice + 1}`, ...mensaje })),
        ),
      ),
      guardarReferencias: jest.fn().mockImplementation((referencias) =>
        Promise.resolve(
          referencias.map((referencia, indice) => ({ id: `referencia-${indice + 1}`, ...referencia })),
        ),
      ),
      listar: jest.fn().mockResolvedValue({ items: [], total: 0 }),
      obtenerMensajes: jest.fn().mockResolvedValue([]),
      eliminar: jest.fn().mockResolvedValue(true),
    },
    documentoRepository: {
      obtenerDocumentoPorId: jest.fn().mockResolvedValue(documento),
    },
    materiaRepository: {
      obtenerMateriaPorId: jest.fn().mockResolvedValue({ id: MATERIA_ID }),
    },
    fragmentoRepository: {
      buscarSimilares: jest.fn().mockResolvedValue(fragmentos),
    },
    consumoRepository: {
      contar: jest.fn().mockImplementation(() => Promise.resolve(consumos.shift() ?? 0)),
      registrar: jest.fn().mockResolvedValue({ id: 'consumo-id' }),
    },
    embeddingsService: {
      generarEmbeddings: jest.fn().mockImplementation(() =>
        embeddingError ? Promise.reject(embeddingError) : Promise.resolve([EMBEDDING]),
      ),
    },
    agenteIaService: {
      responder: jest.fn().mockImplementation(() =>
        respuestaError
          ? Promise.reject(respuestaError)
          : Promise.resolve({
            respuesta: 'Según tus documentos, la derivada mide la tasa de cambio.',
            modelo: 'gpt-4o-mini',
            tokensEntrada: 1200,
            tokensSalida: 240,
          }),
      ),
    },
    usuarioActualId: USUARIO_ID,
  };

  return { servicio: new ChatService(dependencias), dependencias };
}

describe('ChatService (HU12)', () => {
  it('usa el umbral calibrado y las cuotas documentadas', () => {
    expect(UMBRAL_SIMILITUD).toBe(0.55);
    expect(LIMITE_CHAT_POR_HORA).toBe(30);
    expect(LIMITE_CHAT_POR_DIA).toBe(200);
  });

  it('crea la conversacion y guarda mensaje, respuesta, cita y consumo', async () => {
    const { servicio, dependencias } = crearServicio();

    const resultado = await servicio.enviar({
      mensaje: '¿Qué es una derivada?',
      documentoIds: [DOCUMENTO_ID],
    });

    expect(dependencias.conversacionRepository.crear).toHaveBeenCalledWith(USUARIO_ID, {
      titulo: '¿Qué es una derivada?',
      tipo: 'academica',
    });
    expect(dependencias.conversacionRepository.guardarMensajes).toHaveBeenCalledWith([
      expect.objectContaining({ rol_mensaje: 'usuario', intencion: 'documental' }),
      expect.objectContaining({
        rol_mensaje: 'asistente',
        modelo_utilizado: 'gpt-4o-mini',
        intencion: 'documental',
      }),
    ]);
    expect(dependencias.conversacionRepository.guardarReferencias).toHaveBeenCalledWith([
      expect.objectContaining({
        mensaje_id: 'mensaje-2',
        fragmento_id: FRAGMENTO_ID,
        documento_id: DOCUMENTO_ID,
        numero_pagina: 12,
      }),
    ]);
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ usuario_id: USUARIO_ID, operacion: 'chat' }),
    );
    expect(resultado).toEqual({
      conversacion_id: 'conversacion-nueva',
      mensaje_id: 'mensaje-2',
      respuesta: 'Según tus documentos, la derivada mide la tasa de cambio.',
      modelo: 'gpt-4o-mini',
      referencias: [
        {
          documento_id: DOCUMENTO_ID,
          documento_nombre: 'Apuntes de cálculo',
          fragmento_id: FRAGMENTO_ID,
          numero_pagina: 12,
          extracto: 'La derivada mide la tasa de cambio instantánea.',
        },
      ],
      consumo: { tokens_entrada: 1200, tokens_salida: 240 },
    });
  });

  it('envia el contexto y los ultimos turnos al modelo en una conversacion existente', async () => {
    const convertidor = {
      id: CONVERSACION_ID,
      usuario_id: USUARIO_ID,
      titulo: 'Derivadas',
    };
    const { servicio, dependencias } = crearServicio({ conversacion: convertidor });
    dependencias.conversacionRepository.obtenerHistorialReciente.mockResolvedValue([
      { rol_mensaje: 'usuario', contenido: '¿Qué es la pendiente?' },
      { rol_mensaje: 'asistente', contenido: 'Es la inclinación de la recta tangente.' },
    ]);

    await servicio.enviar({ conversacionId: CONVERSACION_ID, mensaje: '¿Y la derivada?' });

    expect(dependencias.conversacionRepository.obtenerPorId).toHaveBeenCalledWith(
      USUARIO_ID,
      CONVERSACION_ID,
    );
    expect(dependencias.conversacionRepository.crear).not.toHaveBeenCalled();
    expect(dependencias.agenteIaService.responder).toHaveBeenCalledWith({
      pregunta: '¿Y la derivada?',
      contexto: [
        {
          documento_nombre: 'Apuntes de cálculo',
          numero_pagina: 12,
          contenido: 'La derivada mide la tasa de cambio instantánea.',
        },
      ],
      historial: [
        { rol_mensaje: 'usuario', contenido: '¿Qué es la pendiente?' },
        { rol_mensaje: 'asistente', contenido: 'Es la inclinación de la recta tangente.' },
      ],
    });
  });

  it('rechaza un documento ajeno sin consultar fragmentos', async () => {
    const { servicio, dependencias } = crearServicio({ documento: null });

    await expect(
      servicio.enviar({ mensaje: 'Explícame esto', documentoIds: [DOCUMENTO_ID] }),
    ).rejects.toMatchObject({ statusCode: 404 });

    expect(dependencias.documentoRepository.obtenerDocumentoPorId).toHaveBeenCalledWith(
      USUARIO_ID,
      DOCUMENTO_ID,
    );
    expect(dependencias.embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
  });

  it('indica que no hay informacion suficiente sin inventar respuesta', async () => {
    const { servicio, dependencias } = crearServicio({ fragmentos: [] });

    const resultado = await servicio.enviar({ mensaje: 'Tema inexistente' });

    expect(resultado.respuesta).toBe(MENSAJE_SIN_INFORMACION);
    expect(resultado.modelo).toBeNull();
    expect(resultado.referencias).toEqual([]);
    expect(dependencias.agenteIaService.responder).not.toHaveBeenCalled();
    expect(dependencias.conversacionRepository.guardarMensajes).toHaveBeenCalledWith([
      expect.objectContaining({ intencion: 'sin_informacion' }),
      expect.objectContaining({ intencion: 'sin_informacion' }),
    ]);
    expect(dependencias.consumoRepository.registrar).toHaveBeenCalledTimes(1);
  });

  it('omite la recuperacion cuando se desactiva el uso de documentos', async () => {
    const { servicio, dependencias } = crearServicio();

    await servicio.enviar({ mensaje: '¿Qué es la fotosíntesis?', usarDocumentos: false });

    expect(dependencias.embeddingsService.generarEmbeddings).not.toHaveBeenCalled();
    expect(dependencias.fragmentoRepository.buscarSimilares).not.toHaveBeenCalled();
    expect(dependencias.agenteIaService.responder).toHaveBeenCalledWith(
      expect.objectContaining({ contexto: [] }),
    );
    expect(dependencias.conversacionRepository.guardarMensajes).toHaveBeenCalledWith([
      expect.objectContaining({ intencion: 'general' }),
      expect.objectContaining({ intencion: 'general' }),
    ]);
  });

  it('devuelve 429 con codigo de cuota al agotar los mensajes por hora', async () => {
    const { servicio } = crearServicio({ consumos: [LIMITE_CHAT_POR_HORA, 0] });

    await expect(servicio.enviar({ mensaje: 'Hola' })).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
  });

  it('devuelve 429 con codigo de cuota al agotar los mensajes del dia', async () => {
    const { servicio } = crearServicio({ consumos: [1, LIMITE_CHAT_POR_DIA] });

    await expect(servicio.enviar({ mensaje: 'Hola' })).rejects.toMatchObject({
      statusCode: 429,
      details: { code: 'AI_QUOTA_EXCEEDED' },
    });
  });

  it('traduce un fallo de embeddings a 503', async () => {
    const { servicio } = crearServicio({
      embeddingError: ErrorProcesamiento.temporal('El proveedor de embeddings no respondio.'),
    });

    await expect(servicio.enviar({ mensaje: 'Hola' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('traduce un fallo del agente a 503', async () => {
    const { servicio } = crearServicio({
      respuestaError: new AgenteIaError('El proveedor de IA no respondio a tiempo.'),
    });

    await expect(servicio.enviar({ mensaje: 'Hola' })).rejects.toMatchObject({ statusCode: 503 });
  });

  it('devuelve 404 al consultar una conversacion ajena', async () => {
    const { servicio } = crearServicio();

    await expect(servicio.obtener(CONVERSACION_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('devuelve 404 al eliminar una conversacion que no existe', async () => {
    const { servicio, dependencias } = crearServicio();
    dependencias.conversacionRepository.eliminar.mockResolvedValue(false);

    await expect(servicio.eliminar(CONVERSACION_ID)).rejects.toMatchObject({ statusCode: 404 });
  });

  it('mapea los roles de base de datos al contrato del frontend', async () => {
    const convertidor = { id: CONVERSACION_ID, usuario_id: USUARIO_ID, titulo: 'Derivadas' };
    const { servicio, dependencias } = crearServicio({ conversacion: convertidor });
    dependencias.conversacionRepository.obtenerMensajes.mockResolvedValue([
      {
        id: 'mensaje-1',
        conversacion_id: CONVERSACION_ID,
        rol_mensaje: 'usuario',
        contenido: 'Hola',
        fecha_creacion: '2026-11-19T10:00:00.000Z',
        referencias: [],
      },
      {
        id: 'mensaje-2',
        conversacion_id: CONVERSACION_ID,
        rol_mensaje: 'asistente',
        contenido: '¡Hola!',
        fecha_creacion: '2026-11-19T10:00:01.000Z',
        referencias: [],
      },
    ]);

    const resultado = await servicio.obtener(CONVERSACION_ID);

    expect(resultado.mensajes.map((mensaje) => mensaje.rol_mensaje)).toEqual([
      'user',
      'assistant',
    ]);
  });

  it('deduplica, ordena y limita los fragmentos del contexto', () => {
    const fragmentos = Array.from({ length: TOP_K_BUSQUEDA + 3 }, (_, indice) => ({
      id: `fragmento-${indice}`,
      documento_id: DOCUMENTO_ID,
      documento_nombre: 'Apuntes',
      contenido: `Contenido ${indice}`,
      similitud: indice / 20,
    }));

    const resultado = seleccionarFragmentos([...fragmentos, fragmentos[0]]);

    expect(resultado).toHaveLength(TOP_K_BUSQUEDA);
    expect(resultado[0].fragmento_id).toBe(`fragmento-${TOP_K_BUSQUEDA + 2}`);
    expect(new Set(resultado.map((fragmento) => fragmento.fragmento_id)).size).toBe(
      TOP_K_BUSQUEDA,
    );
  });
});
