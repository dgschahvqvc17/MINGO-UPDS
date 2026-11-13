/**
 * Controlador HTTP de documentos academicos (HU07).
 * Traduce HTTP -> servicio -> HTTP y responde con el sobre estandar.
 */
class DocumentoController {
  /**
   * @param {{ documentoService: import('../services/documento.service') }} dependencies
   */
  constructor({ documentoService }) {
    this.documentoService = documentoService;
  }

  solicitarUrlCarga = async (req, res) => {
    const datos = await this.documentoService.solicitarUrlCarga(req.validated.body);

    res.status(200).json({
      success: true,
      data: datos,
    });
  };

  listarDocumentos = async (req, res) => {
    const { documentos, paginacion } = await this.documentoService.listarDocumentos(
      req.validated?.query ?? req.query,
    );

    res.status(200).json({
      success: true,
      data: documentos,
      meta: { paginacion },
    });
  };

  registrarDocumento = async (req, res) => {
    const documento = await this.documentoService.registrarDocumento(req.validated.body);

    res.status(201).json({
      success: true,
      message: 'Documento registrado exitosamente.',
      data: documento,
    });
  };

  obtenerDocumento = async (req, res) => {
    const documento = await this.documentoService.obtenerDocumento(req.validated.params.id);

    res.status(200).json({
      success: true,
      data: documento,
    });
  };

  obtenerUrlDescarga = async (req, res) => {
    const descarga = await this.documentoService.obtenerUrlDescarga(req.validated.params.id);

    res.status(200).json({
      success: true,
      data: descarga,
    });
  };

  eliminarDocumento = async (req, res) => {
    const resultado = await this.documentoService.eliminarDocumento(req.validated.params.id);

    res.status(200).json({
      success: true,
      message: 'Documento eliminado exitosamente.',
      data: resultado,
    });
  };
}

module.exports = DocumentoController;
