/**
 * Reglas de negocio de objetivos academicos (HU17). No conoce req ni res:
 * recibe el identificador del usuario autenticado y las dependencias por
 * constructor para poder probarlo con dobles.
 */
const ApiError = require('../utils/ApiError');

class ObjetivoService {
  /**
   * @param {{
   *   objetivoRepository: import('../repositories/objetivo.repository'),
   *   materiaRepository: import('../repositories/materia.repository'),
   *   usuarioActualId: string
   * }} dependencias
   */
  constructor({ objetivoRepository, materiaRepository, usuarioActualId }) {
    this.objetivoRepository = objetivoRepository;
    this.materiaRepository = materiaRepository;
    this.usuarioActualId = usuarioActualId;
  }

  /**
   * @param {{ estado?: string, limite: number, desplazamiento: number }} opciones
   */
  async listar({ estado, limite, desplazamiento }) {
    return this.objetivoRepository.listar(this.usuarioActualId, {
      ...(estado ? { estado } : {}),
      limit: limite,
      offset: desplazamiento,
    });
  }

  /**
   * @param {string} objetivoId
   */
  async obtener(objetivoId) {
    const objetivo = await this.objetivoRepository.obtenerPorId(
      this.usuarioActualId,
      objetivoId,
    );

    if (!objetivo) {
      throw ApiError.notFound('Objetivo no encontrado.');
    }

    return objetivo;
  }

  /**
   * @param {{
   *   titulo: string,
   *   descripcion?: string | null,
   *   materiaId?: string | null,
   *   fechaLimite?: string | null
   * }} datos
   */
  async crear(datos) {
    await this.validarMateria(datos.materiaId);

    return this.objetivoRepository.crear({
      usuario_id: this.usuarioActualId,
      materia_id: datos.materiaId ?? null,
      titulo: datos.titulo,
      descripcion: datos.descripcion ?? null,
      fecha_limite: datos.fechaLimite ?? null,
      estado: 'pendiente',
    });
  }

  /**
   * @param {string} objetivoId
   * @param {{
   *   titulo?: string,
   *   descripcion?: string | null,
   *   materiaId?: string | null,
   *   fechaLimite?: string | null,
   *   estado?: string
   * }} cambios
   */
  async actualizar(objetivoId, cambios) {
    await this.obtener(objetivoId);

    if (Object.hasOwn(cambios, 'materiaId')) {
      await this.validarMateria(cambios.materiaId);
    }

    const columnas = {};
    if (cambios.titulo !== undefined) columnas.titulo = cambios.titulo;
    if (cambios.descripcion !== undefined) columnas.descripcion = cambios.descripcion;
    if (cambios.estado !== undefined) columnas.estado = cambios.estado;
    if (Object.hasOwn(cambios, 'materiaId')) columnas.materia_id = cambios.materiaId ?? null;
    if (Object.hasOwn(cambios, 'fechaLimite')) columnas.fecha_limite = cambios.fechaLimite ?? null;

    return this.objetivoRepository.actualizar(this.usuarioActualId, objetivoId, columnas);
  }

  /**
   * @param {string} objetivoId
   */
  async eliminar(objetivoId) {
    await this.obtener(objetivoId);
    await this.objetivoRepository.eliminar(this.usuarioActualId, objetivoId);
  }

  /**
   * La materia es opcional, pero si se indica debe pertenecer al usuario.
   * Un recurso ajeno se trata como inexistente para no filtrar informacion.
   *
   * @param {string | null | undefined} materiaId
   */
  async validarMateria(materiaId) {
    if (!materiaId) {
      return;
    }

    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada.');
    }
  }
}

module.exports = ObjetivoService;
