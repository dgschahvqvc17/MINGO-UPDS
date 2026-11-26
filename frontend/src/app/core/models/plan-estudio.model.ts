export const DIAS_SEMANA = [
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
  'domingo',
] as const;

export type DiaSemana = (typeof DIAS_SEMANA)[number];

export const TIPOS_SESION = ['lectura', 'practica', 'repaso', 'ejercicios'] as const;
export type TipoSesion = (typeof TIPOS_SESION)[number];

export const ESTADOS_SESION = ['pendiente', 'completada'] as const;
export type EstadoSesion = (typeof ESTADOS_SESION)[number];

export const ETIQUETAS_DIAS: Record<DiaSemana, string> = {
  lunes: 'Lunes',
  martes: 'Martes',
  miercoles: 'Miércoles',
  jueves: 'Jueves',
  viernes: 'Viernes',
  sabado: 'Sábado',
  domingo: 'Domingo',
};

export interface SolicitudPlan {
  materia_id: string;
  objetivo: string;
  fecha_examen: string;
  minutos_por_dia: number;
  dias_disponibles: DiaSemana[];
}

export interface SesionPlanificada {
  tema: string;
  actividades: string;
  fecha_inicio: string;
  duracion_minutos: number;
  tipo?: TipoSesion;
  orden?: number;
}

export interface PropuestaPlan extends SolicitudPlan {
  es_propuesta: true;
  materia_nombre: string;
  resumen: string | null;
  sesiones: SesionPlanificada[];
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
}

export interface SesionEstudio extends Omit<SesionPlanificada, 'tipo'> {
  tipo: TipoSesion | null;
  id: string;
  plan_id: string;
  evento_calendario_id: string | null;
  orden: number;
  estado: EstadoSesion;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export interface PlanEstudio {
  id: string;
  usuario_id: string;
  materia_id: string;
  materia_nombre: string | null;
  materia_codigo: string | null;
  objetivo: string;
  fecha_examen: string;
  minutos_por_dia: number;
  dias_disponibles: DiaSemana[];
  estado: 'confirmado' | 'descartado';
  modelo: string | null;
  tokens_entrada: number;
  tokens_salida: number;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
}

export interface PlanEstudioDetalle extends PlanEstudio {
  sesiones: SesionEstudio[];
}

export function aFechaLocal(fechaIso: string): string {
  const fecha = new Date(fechaIso);

  if (Number.isNaN(fecha.getTime())) {
    return '';
  }

  const año = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');

  return `${año}-${mes}-${dia}T${horas}:${minutos}`;
}

/**
 * Convierte una fecha local de `datetime-local` a ISO 8601 conservando el dia
 * del calendario del estudiante en la propia cadena (por ejemplo,
 * `2026-12-10T09:00:00-05:00`). Asi el servidor puede compararla con la fecha
 * de la evaluacion sin confundir el desplazamiento con un dia distinto.
 */
export function aIsoConZona(fechaLocal: string): string {
  if (!fechaLocal) {
    return '';
  }

  const fecha = new Date(fechaLocal);
  if (Number.isNaN(fecha.getTime())) {
    return '';
  }

  const desplazamientoMinutos = -fecha.getTimezoneOffset();
  const signo = desplazamientoMinutos >= 0 ? '+' : '-';
  const horas = String(Math.floor(Math.abs(desplazamientoMinutos) / 60)).padStart(2, '0');
  const minutos = String(Math.abs(desplazamientoMinutos) % 60).padStart(2, '0');
  const base = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(fechaLocal)
    ? `${fechaLocal}:00`
    : fechaLocal;

  return `${base}${signo}${horas}:${minutos}`;
}
