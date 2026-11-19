const PREFIJO_CLAVE = 'mingo';

/**
 * Genera una clave Idempotency-Key para una solicitud que puede reintentarse.
 * El navegador expone crypto.randomUUID en contextos seguros; se deja una
 * alternativa para entornos de prueba o navegadores antiguos.
 */
export function crearClaveIdempotencia(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const aleatorio = Math.random().toString(36).slice(2, 12);
  return `${PREFIJO_CLAVE}-${Date.now()}-${aleatorio}`;
}
