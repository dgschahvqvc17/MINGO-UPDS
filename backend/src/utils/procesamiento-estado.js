/**
 * Reglas compartidas sobre el estado de procesamiento de un documento (HU09).
 * Las usan la API y el worker para distinguir un trabajo activo de uno atascado.
 * No conoce HTTP ni la base de datos.
 */

/** Minutos sin cambios tras los que un trabajo en proceso se considera atascado. */
const MINUTOS_ESTANCADO = 15;

/** Estados que indican que hay un trabajo pendiente o en ejecucion. */
const ESTADOS_EN_PROCESO = Object.freeze(['en_cola', 'procesando']);

/** Estados que indican que el worker ya esta ejecutando el trabajo. */
const ESTADOS_PROCESANDO = Object.freeze(['procesando']);

/**
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function estaEnProceso(estado) {
  return ESTADOS_EN_PROCESO.includes(estado);
}

/**
 * `en_cola` es trabajo pendiente, no ejecucion: el worker debe poder iniciarlo
 * en la primera entrega del mensaje.
 *
 * @param {string | null | undefined} estado
 * @returns {boolean}
 */
function estaProcesando(estado) {
  return ESTADOS_PROCESANDO.includes(estado);
}

/**
 * Fecha de corte: todo documento actualizado antes de este instante esta atascado.
 *
 * @param {{ ahora?: Date, minutos?: number }} [opciones]
 * @returns {string} Fecha ISO 8601.
 */
function calcularCorte({ ahora = new Date(), minutos = MINUTOS_ESTANCADO } = {}) {
  return new Date(ahora.getTime() - minutos * 60 * 1000).toISOString();
}

/**
 * Un documento esta atascado cuando sigue en proceso y no se actualizo
 * dentro de la ventana permitida. Sin `fecha_actualizacion` se considera
 * atascado: no hay forma de demostrar que el trabajo sigue vivo.
 *
 * @param {{ estado_procesamiento?: string | null, fecha_actualizacion?: string | null } | null} documento
 * @param {{ ahora?: Date, minutos?: number }} [opciones]
 * @returns {boolean}
 */
function estaEstancado(documento, { ahora = new Date(), minutos = MINUTOS_ESTANCADO } = {}) {
  if (!documento || !estaEnProceso(documento.estado_procesamiento)) {
    return false;
  }

  if (!documento.fecha_actualizacion) {
    return true;
  }

  const actualizacion = new Date(documento.fecha_actualizacion).getTime();
  if (Number.isNaN(actualizacion)) {
    return true;
  }

  return actualizacion <= new Date(ahora.getTime() - minutos * 60 * 1000).getTime();
}

module.exports = {
  ESTADOS_EN_PROCESO,
  ESTADOS_PROCESANDO,
  MINUTOS_ESTANCADO,
  calcularCorte,
  estaEnProceso,
  estaProcesando,
  estaEstancado,
};
