/**
 * Modelos del dominio academico de MINGO.
 * Los nombres de campos coinciden con las columnas de PostgreSQL/Supabase.
 */

export type RolUsuario = 'administrador' | 'estudiante';

export type EstadoGeneral = 'activo' | 'inactivo' | 'archivado';

export type EstadoTarea = 'pendiente' | 'en_progreso' | 'completada';

export type Prioridad = 'baja' | 'media' | 'alta';

export type TipoEvento = 'entrega' | 'examen' | 'exposicion' | 'practica' | 'estudio' | 'otro';

export type EstadoProcesamiento = 'pendiente' | 'en_proceso' | 'procesado' | 'error';

export type RolMensaje = 'user' | 'assistant' | 'system';

export type TipoPregunta = 'opcion_multiple' | 'verdadero_falso' | 'abierta';

export interface Perfil {
  id: string;
  auth_user_id: string;
  nombre: string;
  apellido: string;
  correo: string;
  foto_perfil: string | null;
  universidad: string | null;
  carrera: string | null;
  semestre: number | null;
  estado: EstadoGeneral;
  fecha_creacion: string;
}

export interface Rol {
  id: string;
  nombre: RolUsuario;
  descripcion: string | null;
}

export interface UsuarioRol {
  id: string;
  usuario_id: string;
  rol_id: string;
}

export interface PeriodoAcademico {
  id: string;
  usuario_id: string;
  nombre: string;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoGeneral;
}

export interface Materia {
  id: string;
  usuario_id: string;
  periodo_id: string | null;
  nombre: string;
  codigo: string | null;
  docente: string | null;
  descripcion: string | null;
  color: string | null;
  estado: EstadoGeneral;
  fecha_creacion: string;
}

export interface Unidad {
  id: string;
  materia_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

export interface Tarea {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  unidad_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo: string | null;
  prioridad: Prioridad;
  fecha_asignacion: string | null;
  fecha_entrega: string | null;
  estado: EstadoTarea;
  fecha_creacion: string;
}

export interface EventoCalendario {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  tarea_id: string | null;
  titulo: string;
  descripcion: string | null;
  tipo_evento: TipoEvento;
  fecha_inicio: string;
  fecha_fin: string | null;
  recordatorio: boolean;
  estado: EstadoGeneral;
}

export interface Documento {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  unidad_id: string | null;
  nombre: string;
  nombre_archivo: string;
  tipo_archivo: string;
  ruta_almacenamiento: string;
  tamano: number;
  estado_procesamiento: EstadoProcesamiento;
  fecha_carga: string;
}

export interface FragmentoDocumento {
  id: string;
  documento_id: string;
  contenido: string;
  numero_pagina: number | null;
  numero_fragmento: number;
  fecha_creacion: string;
}

export interface Conversacion {
  id: string;
  usuario_id: string;
  titulo: string;
  tipo_conversacion: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

export interface Mensaje {
  id: string;
  conversacion_id: string;
  rol_mensaje: RolMensaje;
  contenido: string;
  modelo_utilizado: string | null;
  fecha_creacion: string;
}

export interface ReferenciaRespuesta {
  id: string;
  mensaje_id: string;
  fragmento_id: string;
  documento_id: string;
  numero_pagina: number | null;
}

export interface PlanEstudio {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  titulo: string;
  objetivo: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: EstadoGeneral;
  fecha_creacion: string;
}

export interface SesionEstudio {
  id: string;
  plan_id: string;
  materia_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha_programada: string;
  duracion_minutos: number;
  estado: string;
}

export interface Cuestionario {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  documento_id: string | null;
  titulo: string;
  descripcion: string | null;
  cantidad_preguntas: number;
  fecha_creacion: string;
}

export interface Pregunta {
  id: string;
  cuestionario_id: string;
  enunciado: string;
  tipo_pregunta: TipoPregunta;
  explicacion: string | null;
  respuesta_correcta: string | null;
}

export interface OpcionPregunta {
  id: string;
  pregunta_id: string;
  contenido: string;
  es_correcta: boolean;
}

export interface IntentoCuestionario {
  id: string;
  usuario_id: string;
  cuestionario_id: string;
  puntuacion: number | null;
  fecha_inicio: string;
  fecha_finalizacion: string | null;
}

export interface RespuestaUsuario {
  id: string;
  intento_id: string;
  pregunta_id: string;
  respuesta: string;
  es_correcta: boolean | null;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  titulo: string;
  mensaje: string;
  tipo: string;
  fecha_programada: string | null;
  fecha_envio: string | null;
  leida: boolean;
  estado: EstadoGeneral;
}

export interface ObjetivoEstudio {
  id: string;
  usuario_id: string;
  materia_id: string | null;
  titulo: string;
  descripcion: string | null;
  fecha_limite: string | null;
  estado: string;
  fecha_creacion: string;
}

export interface PreferenciasUsuario {
  id: string;
  usuario_id: string;
  notificaciones_activas: boolean;
  zona_horaria: string;
  idioma: string;
  configuracion_ia: Record<string, unknown> | null;
}
