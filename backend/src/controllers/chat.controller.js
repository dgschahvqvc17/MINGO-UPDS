/**
 * Controlador HTTP del chat academico (HU12).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class ChatController {
  /**
   * @param {{ chatService: import('../services/chat.service') }} dependencies
   */
  constructor({ chatService }) {
    this.chatService = chatService;
  }

  enviar = async (req, res) => {
    const {
      conversacion_id,
      mensaje,
      materia_id,
      documento_ids,
      usar_documentos,
    } = req.validated.body;

    const respuesta = await this.chatService.enviar({
      conversacionId: conversacion_id,
      mensaje,
      materiaId: materia_id,
      documentoIds: documento_ids,
      usarDocumentos: usar_documentos,
    });

    res.status(200).json({ success: true, data: respuesta });
  };

  listar = async (req, res) => {
    const { limit, offset } = req.validated.query;
    const { items, total } = await this.chatService.listar({
      limite: limit,
      desplazamiento: offset,
    });

    res.status(200).json({
      success: true,
      data: items,
      meta: {
        page: Math.floor(offset / limit) + 1,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  };

  obtener = async (req, res) => {
    const conversacion = await this.chatService.obtener(req.validated.params.id);
    res.status(200).json({ success: true, data: conversacion });
  };

  eliminar = async (req, res) => {
    const { id } = req.validated.params;
    await this.chatService.eliminar(id);
    res.status(200).json({ success: true, data: { id } });
  };
}

module.exports = ChatController;
