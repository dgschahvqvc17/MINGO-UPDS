/**
 * Controlador HTTP de tareas académicas (HU04).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estándar.
 * La validación de entrada se realiza en el middleware de rutas.
 */
class TareaController {
  /**
   * @param {{ tareaService: import('../services/tarea.service') }} dependencies
   */
  constructor({ tareaService }) {
    this.tareaService = tareaService;
  }

  listarTareas = async (req, res) => {
    const filtros = req.validated?.query ?? req.query;
    const { tareas, paginacion } = await this.tareaService.listarTareas(filtros);

    res.status(200).json({
      success: true,
      data: tareas,
      meta: { paginacion },
    });
  };

  listarProximas = async (req, res) => {
    const filtros = req.validated?.query ?? req.query;
    const { tareas, rango } = await this.tareaService.listarProximas(filtros);

    res.status(200).json({
      success: true,
      data: tareas,
      meta: {
        total: tareas.length,
        rango,
      },
    });
  };

  obtenerEstadisticas = async (req, res) => {
    const estadisticas = await this.tareaService.obtenerEstadisticas();

    res.status(200).json({
      success: true,
      data: estadisticas,
    });
  };

  obtenerTarea = async (req, res) => {
    const { id: tareaId } = req.validated.params;
    const tarea = await this.tareaService.obtenerTarea(tareaId);

    res.status(200).json({
      success: true,
      data: tarea,
    });
  };

  crearTarea = async (req, res) => {
    const tarea = await this.tareaService.crearTarea(req.validated.body);

    res.status(201).json({
      success: true,
      message: 'Tarea creada exitosamente.',
      data: tarea,
    });
  };

  actualizarTarea = async (req, res) => {
    const { id: tareaId } = req.validated.params;
    const tarea = await this.tareaService.actualizarTarea(tareaId, req.validated.body);

    res.status(200).json({
      success: true,
      message: 'Tarea actualizada exitosamente.',
      data: tarea,
    });
  };

  cambiarEstadoTarea = async (req, res) => {
    const { id: tareaId } = req.validated.params;
    const { estado } = req.validated.body;
    const tarea = await this.tareaService.cambiarEstadoTarea(tareaId, estado);

    res.status(200).json({
      success: true,
      message: 'Estado de la tarea actualizado.',
      data: tarea,
    });
  };

  eliminarTarea = async (req, res) => {
    const { id: tareaId } = req.validated.params;
    await this.tareaService.eliminarTarea(tareaId);

    res.status(200).json({
      success: true,
      message: 'Tarea eliminada exitosamente.',
      data: { id: tareaId },
    });
  };
}

module.exports = TareaController;
