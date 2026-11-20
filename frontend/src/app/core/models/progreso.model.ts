export const ESTADOS_OBJETIVO = ['pendiente', 'en_progreso', 'completada'] as const;
export type EstadoObjetivo = (typeof ESTADOS_OBJETIVO)[number];

export const ETIQUETAS_OBJETIVO: Record<EstadoObjetivo, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
};

export interface ObjetivoMateria {
  nombre: string;
  codigo?: string | null;
  color?: string | null;
}

export interface Objetivo {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  estado: EstadoObjetivo;
  fecha_creacion: string;
  fecha_actualizacion: string | null;
  materias: ObjetivoMateria | null;
}

export interface ConteoEstado {
  estado: string;
  total: number;
}

export interface ActividadDia {
  fecha: string;
  etiqueta: string;
  tareas: number;
  sesiones: number;
}

export interface Atencion {
  tipo: 'tarea' | 'sesion' | 'objetivo';
  id: string;
  titulo: string;
  materia: string | null;
  motivo: string;
  fecha: string;
}

export interface Recomendacion {
  tipo: string;
  prioridad: 'alta' | 'media' | 'baja';
  mensaje: string;
}

export interface ResumenProgreso {
  materias_activas: number;
  tareas_pendientes: number;
  tareas_completadas: number;
  cumplimiento_tareas: number;
  sesiones_totales: number;
  sesiones_completadas: number;
  cumplimiento_sesiones: number;
  minutos_estudiados: number;
  cuestionarios_completados: number;
  promedio_cuestionarios: number | null;
  objetivos_activos: number;
  objetivos_completados: number;
  cumplimiento_objetivos: number;
  racha_dias: number;
}

export interface Progreso {
  materias_activas: number;
  tareas_pendientes: number;
  tareas_completadas: number;
  cumplimiento_tareas: number;
  sesiones_totales: number;
  sesiones_completadas: number;
  cumplimiento_sesiones: number;
  minutos_estudiados: number;
  cuestionarios_completados: number;
  promedio_cuestionarios: number | null;
  objetivos_activos: number;
  objetivos_completados: number;
  cumplimiento_objetivos: number;
  racha_dias: number;
  por_estado: {
    tareas: ConteoEstado[];
    objetivos: ConteoEstado[];
    sesiones: ConteoEstado[];
  };
  actividad_semanal: ActividadDia[];
  actividades_atencion: Atencion[];
  recomendaciones: Recomendacion[];
  generado_en: string;
}
