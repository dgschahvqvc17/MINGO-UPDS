/**
 * Extrae un mensaje apto para el usuario desde un error HTTP o de red.
 * El backend responde { success: false, error: { message } }.
 */
export function mensajeDeErrorHttp(error: unknown, mensajePorDefecto: string): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  const cuerpo = error as { error?: unknown; message?: unknown };
  const detalle = cuerpo.error;

  if (typeof detalle === 'string' && detalle.trim()) {
    return detalle;
  }

  if (detalle && typeof detalle === 'object') {
    const interno = detalle as { error?: { message?: unknown }; message?: unknown };
    const mensaje = interno.error?.message ?? interno.message;

    if (typeof mensaje === 'string' && mensaje.trim()) {
      return mensaje;
    }
  }

  return typeof cuerpo.message === 'string' && cuerpo.message.trim()
    ? cuerpo.message
    : mensajePorDefecto;
}
