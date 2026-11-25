/**
 * Reglas de negocio de inscripciones.
 * Solo el administrador y el docente responsable gestionan las inscripciones
 * de una materia. Los estudiantes no consultan este recurso.
 */
const ApiError = require('../utils/ApiError');
const { inscripcionBusquedaSchema } = require('../models/inscripcion.model');
const { ROLE_ADMINISTRADOR } = require('../models/roles.model');

class InscripcionService {
  /**
   * @param {{
   *   inscripcionRepository: import('../repositories/inscripcion.repository'),
   *   materiaRepository: import('../repositories/materia.repository'),
   *   usuarioActualId: string,
   *   rol: string
   * }} dependencies
   */
  constructor({ inscripcionRepository, materiaRepository, usuarioActualId, rol }) {
    this.inscripcionRepository = inscripcionRepository;
    this.materiaRepository = materiaRepository;
    this.usuarioActualId = usuarioActualId;
    this.rol = rol;
  }

  async listar(materiaId, filtros = {}) {
    const validados = inscripcionBusquedaSchema.parse(filtros);

    if (this.rol === ROLE_ADMINISTRADOR) {
      return this.inscripcionRepository.listar({ materiaId, ...validados });
    }

    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia || materia.docente_id !== this.usuarioActualId) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    return this.inscripcionRepository.listar({ materiaId, ...validados });
  }

  async inscribir(materiaId, estudianteId) {
    await this.verificarDocencia(materiaId);
    return this.inscripcionRepository.inscribir({ materiaId, estudianteId });
  }

  async desinscribir(materiaId, estudianteId) {
    await this.verificarDocencia(materiaId);
    const inscripcion = await this.inscripcionRepository.desinscribir({ materiaId, estudianteId });

    if (!inscripcion) {
      throw ApiError.notFound('Inscripción no encontrada.');
    }

    return inscripcion;
  }

  async verificarDocencia(materiaId) {
    const materia = await this.materiaRepository.obtenerMateriaPorId(
      this.usuarioActualId,
      materiaId,
    );

    if (!materia) {
      throw ApiError.notFound('Materia no encontrada.');
    }

    if (this.rol !== ROLE_ADMINISTRADOR && materia.docente_id !== this.usuarioActualId) {
      throw ApiError.notFound('Materia no encontrada.');
    }
  }
}

module.exports = InscripcionService;
