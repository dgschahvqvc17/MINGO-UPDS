/**
 * Servicio de tarjetas de memoria (HU14).
 * Aplica las reglas de negocio: propiedad de materia y documento, material
 * suficiente, cuota diaria, validacion de la salida del modelo, persistencia y
 * seguimiento del estado de estudio de cada tarjeta. No conoce req ni res.
 */
const ApiError = require('../utils/ApiError');
const { TarjetaIaError } = require('./ia/tarjeta.ia.service');

const OPERACION = 'tarjeta';
const LIMITE_DIARIO_TARJETAS = 10;

/** 12000 tokens por documento a ~4 caracteres por token. */
const MAXIMO_CARACTERES_CONTENIDO = 48_000;
/** Tope de fragmentos leidos por conjunto; evita consultas y prompts enormes. */
const MAXIMO_FRAGMENTOS = 60;
const MINIMO_CARACTERES_CONTENIDO = 40;
const MAXIMO_CARACTERES_TITULO = 200;

const ESTADO_PROCESADO = 'procesado';
const ESTADO_SIN_REVISAR = 'sin_revisar';
const ESTADO_CONOCIDA = 'conocida';
const FILTRO_PENDIENTES = 'pendientes';

/**
 * @returns {string} Inicio del dia en UTC, en formato ISO 8601.
 */
function inicioDelDia() {
  const fecha = new Date();
  fecha.setUTCHours(0, 0, 0, 0);
  return fecha.toISOString();
}

/**
 * @returns {string} Fin del dia en UTC, en formato ISO 8601.
 */
function finDelDia() {
  return new Date(Date.parse(inicioDelDia()) + 86_400_000).toISOString();
}

/**
 * Compone el material de estudio respetando el presupuesto de caracteres.
 *
 * @param {Array<{ numero_pagina: number | null, contenido: string }>} fragmentos
 * @returns {string}
 */
function armarTexto(fragmentos) {
  const bloques = [];
  let longitud = 0;

  for (const fragmento of fragmentos) {
    const pagina = fragmento.numero_pagina ? ` [Pagina ${fragmento.numero_pagina}]` : '';
    const encabezado = `Fragmento${pagina}:\n`;
    const espacioRestante = MAXIMO_CARACTERES_CONTENIDO - longitud - encabezado.length;

    if (espacioRestante <= 0) {
      break;
    }

    const contenidoFragmento = fragmento.contenido.slice(0, espacioRestante);
    bloques.push(`${encabezado}${contenidoFragmento}`);
    longitud += encabezado.length + contenidoFragmento.length;

    if (contenidoFragmento.length < fragmento.contenido.length) {
      break;
    }
  }

  return bloques.join('\n\n');
}

/**
 * @param {object} fila Fila de `conjuntos_tarjetas` con la relacion `materias`.
 * @param {{ conocidas: number, pendientes: number }} [conteo]
 * @returns {object}
 */
function aConjuntoResumen(fila, conteo) {
  const materia = Array.isArray(fila.materias) ? fila.materias[0] : fila.materias;
  const conocidas = conteo?.conocidas ?? 0;

  return {
    id: fila.id,
    usuario_id: fila.usuario_id,
    materia_id: fila.materia_id,
    materia_nombre: materia?.nombre ?? null,
    documento_id: fila.documento_id,
    titulo: fila.titulo,
    cantidad_tarjetas: fila.cantidad_tarjetas,
    cantidad_conocidas: conocidas,
    cantidad_pendientes:
      conteo?.pendientes ?? Math.max((fila.cantidad_tarjetas ?? 0) - conocidas, 0),
    modelo: fila.modelo,
    tokens_entrada: fila.tokens_entrada,
    tokens_salida: fila.tokens_salida,
    fecha_creacion: fila.fecha_creacion,
  };
}

/**
 * @param {object} tarjeta
 * @returns {object}
 */
function aTarjeta(tarjeta) {
  return {
    id: tarjeta.id,
    conjunto_id: tarjeta.conjunto_id,
    orden: tarjeta.orden,
    frente: tarjeta.frente,
    reverso: tarjeta.reverso,
    estado: tarjeta.estado,
    fecha_actualizacion: tarjeta.fecha_actualizacion,
  };
}

/**
 * @param {Array<{ conjunto_id: string, estado: string }>} filas
 * @returns {Map<string, { conocidas: number, pendientes: number }>}
 */
function agruparConteos(filas) {
  const conteos = new Map();

  for (const fila of filas) {
    const conteo = conteos.get(fila.conjunto_id) ?? { conocidas: 0, pendientes: 0 };

    if (fila.estado === ESTADO_CONOCIDA) {
      conteo.conocidas += 1;
    } else {
      conteo.pendientes += 1;
    }

    conteos.set(fila.conjunto_id, conteo);
  }

  return conteos;
}

class TarjetaService {
  /**
   * @param {{
   *   materiaRepository: object,
   *   documentoRepository: object,
   *   fragmentoRepository: object,
   *   tarjetaRepository: object,
   *   consumoRepository: object,
   *   iaService: object,
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({
    materiaRepository,
    documentoRepository,
    fragmentoRepository,
    tarjetaRepository,
    consumoRepository,
    iaService,
    usuarioActualId,
  }) {
    this.materiaRepository = materiaRepository;
    this.documentoRepository = documentoRepository;
    this.fragmentoRepository = fragmentoRepository;
    this.tarjetaRepository = tarjetaRepository;
    this.consumoRepository = consumoRepository;
    this.iaService = iaService;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * Genera un conjunto de tarjetas a partir de un documento propio o de los
   * documentos procesados de una materia propia.
   *
   * @param {{ materiaId: string, documentoId: string | null, cantidadTarjetas: number }} entrada
   * @returns {Promise<object>}
   */
  async generar({ materiaId, documentoId, cantidadTarjetas }) {
    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    const texto = documentoId
      ? await this.obtenerMaterialDeDocumento(documentoId, materiaId)
      : await this.obtenerMaterialDeMateria(materiaId);

    await this.verificarCuota();

    const generado = await this.generarConIa({ texto, cantidad: cantidadTarjetas });

    await this.consumoRepository.registrar({
      usuario_id: this.usuarioActualId,
      operacion: OPERACION,
      modelo: generado.modelo,
      tokens_entrada: generado.tokensEntrada,
      tokens_salida: generado.tokensSalida,
    });

    const titulo = (generado.contenido.titulo ?? `Tarjetas de ${materia.nombre}`).slice(
      0,
      MAXIMO_CARACTERES_TITULO,
    );

    const guardado = await this.tarjetaRepository.crearConjunto(
      {
        usuario_id: this.usuarioActualId,
        materia_id: materiaId,
        documento_id: documentoId ?? null,
        titulo,
        cantidad_tarjetas: generado.contenido.tarjetas.length,
        modelo: generado.modelo,
        tokens_entrada: generado.tokensEntrada,
        tokens_salida: generado.tokensSalida,
      },
      generado.contenido.tarjetas,
    );

    return {
      ...aConjuntoResumen({ ...guardado, materias: materia }, {
        conocidas: 0,
        pendientes: generado.contenido.tarjetas.length,
      }),
      tarjetas: (guardado.tarjetas ?? []).map(aTarjeta),
    };
  }

  /**
   * Lista los conjuntos del usuario con paginacion y su avance de estudio.
   *
   * @param {{ limite: number, desplazamiento: number }} paginacion
   * @returns {Promise<{ items: object[], total: number }>}
   */
  async listar({ limite, desplazamiento }) {
    const { items, total } = await this.tarjetaRepository.listarConjuntos(
      this.usuarioActualId,
      { limit: limite, offset: desplazamiento },
    );
    const conteos = agruparConteos(
      await this.tarjetaRepository.contarEstados(items.map((item) => item.id)),
    );

    return {
      items: items.map((item) =>
        aConjuntoResumen(item, conteos.get(item.id) ?? { conocidas: 0, pendientes: 0 }),
      ),
      total,
    };
  }

  /**
   * Devuelve un conjunto propio con sus tarjetas. Con `estado: 'pendientes'`
   * excluye las ya marcadas como conocidas.
   *
   * @param {string} conjuntoId
   * @param {{ estado?: string }} [opciones]
   * @returns {Promise<object>}
   */
  async obtener(conjuntoId, { estado = 'todas' } = {}) {
    const conjunto = await this.obtenerConjunto(conjuntoId);
    const conteos = agruparConteos(
      await this.tarjetaRepository.contarEstados([conjuntoId]),
    );
    const tarjetas = await this.tarjetaRepository.listarTarjetas(conjuntoId, {
      soloPendientes: estado === FILTRO_PENDIENTES,
    });

    return {
      ...aConjuntoResumen(conjunto, conteos.get(conjuntoId)),
      tarjetas: tarjetas.map(aTarjeta),
    };
  }

  /**
   * @param {string} conjuntoId
   * @returns {Promise<void>}
   */
  async eliminar(conjuntoId) {
    await this.obtenerConjunto(conjuntoId);
    await this.tarjetaRepository.eliminarConjunto(this.usuarioActualId, conjuntoId);
  }

  /**
   * Registra el avance de estudio de una tarjeta propia.
   *
   * @param {string} tarjetaId
   * @param {string} estado
   * @returns {Promise<object>}
   */
  async actualizarEstado(tarjetaId, estado) {
    const tarjeta = await this.tarjetaRepository.obtenerTarjetaPorId(
      this.usuarioActualId,
      tarjetaId,
    );

    if (!tarjeta) {
      throw ApiError.notFound('Tarjeta no encontrada.');
    }

    const actualizada = await this.tarjetaRepository.actualizarEstado(
      this.usuarioActualId,
      tarjetaId,
      estado,
    );

    return aTarjeta(actualizada ?? { ...tarjeta, estado });
  }

  /**
   * @param {string} documentoId
   * @param {string} materiaId
   * @returns {Promise<string>}
   */
  async obtenerMaterialDeDocumento(documentoId, materiaId) {
    const documento = await this.documentoRepository.obtenerDocumentoPorId(
      this.usuarioActualId,
      documentoId,
    );

    if (!documento || (documento.materia_id && documento.materia_id !== materiaId)) {
      throw ApiError.notFound('Documento no encontrado.');
    }

    if (documento.estado_procesamiento !== ESTADO_PROCESADO) {
      throw ApiError.unprocessable(
        'El documento todavia no esta procesado. Espera a que termine para generar las tarjetas.',
      );
    }

    const fragmentos = await this.fragmentoRepository.listarParaCuestionario(
      documentoId,
      MAXIMO_FRAGMENTOS,
    );

    return this.validarMaterial(armarTexto(fragmentos), 'El documento');
  }

  /**
   * @param {string} materiaId
   * @returns {Promise<string>}
   */
  async obtenerMaterialDeMateria(materiaId) {
    const fragmentos = await this.fragmentoRepository.listarPorMateriaParaCuestionario(
      materiaId,
      MAXIMO_FRAGMENTOS,
    );

    if (fragmentos.length === 0) {
      throw ApiError.unprocessable(
        'La materia no tiene documentos procesados. Sube un documento o selecciona otro.',
      );
    }

    return this.validarMaterial(armarTexto(fragmentos), 'La materia');
  }

  /**
   * @param {string} texto
   * @param {string} origen
   * @returns {string}
   */
  validarMaterial(texto, origen) {
    if (texto.trim().length < MINIMO_CARACTERES_CONTENIDO) {
      throw ApiError.unprocessable(
        `${origen} no tiene contenido suficiente para generar tarjetas.`,
      );
    }

    return texto;
  }

  /**
   * @param {string} conjuntoId
   * @returns {Promise<object>}
   */
  async obtenerConjunto(conjuntoId) {
    const conjunto = await this.tarjetaRepository.obtenerConjuntoPorId(
      this.usuarioActualId,
      conjuntoId,
    );

    if (!conjunto) {
      throw ApiError.notFound('Conjunto de tarjetas no encontrado.');
    }

    return conjunto;
  }

  /**
   * @returns {Promise<void>}
   */
  async verificarCuota() {
    const consumidos = await this.consumoRepository.contar(
      this.usuarioActualId,
      OPERACION,
      inicioDelDia(),
    );

    if (consumidos < LIMITE_DIARIO_TARJETAS) {
      return;
    }

    throw ApiError.rateLimited(
      'Alcanzaste el limite diario de tarjetas. Vuelve a intentarlo mas tarde.',
      { code: 'AI_QUOTA_EXCEEDED', reinicio: finDelDia() },
    );
  }

  /**
   * @param {{ texto: string, cantidad: number }} parametros
   * @returns {Promise<object>}
   */
  async generarConIa(parametros) {
    try {
      return await this.iaService.generarTarjetas(parametros);
    } catch (error) {
      if (error instanceof TarjetaIaError) {
        throw ApiError.serviceUnavailable(error.message);
      }

      throw error;
    }
  }
}

module.exports = TarjetaService;
module.exports.LIMITE_DIARIO_TARJETAS = LIMITE_DIARIO_TARJETAS;
module.exports.MAXIMO_FRAGMENTOS = MAXIMO_FRAGMENTOS;
module.exports.MAXIMO_CARACTERES_CONTENIDO = MAXIMO_CARACTERES_CONTENIDO;
module.exports.MINIMO_CARACTERES_CONTENIDO = MINIMO_CARACTERES_CONTENIDO;
module.exports.ESTADO_SIN_REVISAR = ESTADO_SIN_REVISAR;
module.exports.armarTexto = armarTexto;
