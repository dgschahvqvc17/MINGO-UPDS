/**
 * Controlador HTTP de planes de estudio (HU15).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class PlanEstudioController {
  /**
   * @param {{ planEstudioService: import('../services/plan-estudio.service') }} dependencies
   */
  constructor({ planEstudioService }) {
    this.planEstudioService = planEstudioService;
  }

  proponer = async (req, res) => {
    const datos = req.validated.body;

    const propuesta = await this.planEstudioService.proponer({
      materiaId: datos.materia_id,
      objetivo: datos.objetivo,
      fechaExamen: datos.fecha_examen,
      minutosPorDia: datos.minutos_por_dia,
      diasDisponibles: datos.dias_disponibles,
    });

    res.status(200).json({ success: true, data: propuesta });
  };

  confirmar = async (req, res) => {
    const datos = req.validated.body;

    const plan = await this.planEstudioService.confirmar({
      materiaId: datos.materia_id,
      objetivo: datos.objetivo,
      fechaExamen: datos.fecha_examen,
      minutosPorDia: datos.minutos_por_dia,
      diasDisponibles: datos.dias_disponibles,
      modelo: datos.modelo,
      tokensEntrada: datos.tokens_entrada,
      tokensSalida: datos.tokens_salida,
      sesiones: datos.sesiones.map((sesion) => ({
        tema: sesion.tema,
        actividades: sesion.actividades,
        fechaInicio: sesion.fecha_inicio,
        duracionMinutos: sesion.duracion_minutos,
        tipo: sesion.tipo,
      })),
    });

    res.status(201).json({ success: true, data: plan });
  };

  listar = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.planEstudioService.listar({
      limite: limit,
      desplazamiento: offset,
    });

    res.status(200).json({
      success: true,
      data: items,
      meta: { limit, offset, total },
    });
  };

  obtener = async (req, res) => {
    const { id } = req.validated.params;
    const plan = await this.planEstudioService.obtener(id);
    res.status(200).json({ success: true, data: plan });
  };

  actualizar = async (req, res) => {
    const { id } = req.validated.params;
    const datos = req.validated.body;
    const cambios = {};

    if (datos.objetivo !== undefined) cambios.objetivo = datos.objetivo;
    if (datos.fecha_examen !== undefined) cambios.fecha_examen = datos.fecha_examen;
    if (datos.minutos_por_dia !== undefined) cambios.minutos_por_dia = datos.minutos_por_dia;
    if (datos.dias_disponibles !== undefined) cambios.dias_disponibles = datos.dias_disponibles;

    const plan = await this.planEstudioService.actualizar(id, cambios);
    res.status(200).json({ success: true, data: plan });
  };

  descartar = async (req, res) => {
    const { id } = req.validated.params;
    await this.planEstudioService.descartar(id);
    res.status(200).json({ success: true, data: { id, estado: 'descartado' } });
  };

  agregarSesion = async (req, res) => {
    const { id } = req.validated.params;
    const datos = req.validated.body.sesion;

    const sesion = await this.planEstudioService.agregarSesion(id, {
      tema: datos.tema,
      actividades: datos.actividades,
      fechaInicio: datos.fecha_inicio,
      duracionMinutos: datos.duracion_minutos,
      tipo: datos.tipo,
    });

    res.status(201).json({ success: true, data: sesion });
  };

  actualizarSesion = async (req, res) => {
    const { id } = req.validated.params;
    const datos = req.validated.body;
    const cambios = {};

    if (datos.tema !== undefined) cambios.tema = datos.tema;
    if (datos.actividades !== undefined) cambios.actividades = datos.actividades;
    if (datos.tipo !== undefined) cambios.tipo = datos.tipo;
    if (datos.fecha_inicio !== undefined) cambios.fechaInicio = datos.fecha_inicio;
    if (datos.duracion_minutos !== undefined) cambios.duracionMinutos = datos.duracion_minutos;
    if (datos.estado !== undefined) cambios.estado = datos.estado;

    const sesion = await this.planEstudioService.actualizarSesion(id, cambios);
    res.status(200).json({ success: true, data: sesion });
  };

  eliminarSesion = async (req, res) => {
    const { id } = req.validated.params;
    await this.planEstudioService.eliminarSesion(id);
    res.status(200).json({ success: true, data: { id } });
  };
}

module.exports = PlanEstudioController;
