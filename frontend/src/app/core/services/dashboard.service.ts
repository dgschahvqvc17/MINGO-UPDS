import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { EventoCalendario } from './calendario.service';
import type { Tarea } from './tarea.service';

export interface DashboardMateriasResumen {
  total: number;
  activas: number;
  archivadas: number;
}

export interface DashboardTareasResumen {
  total: number;
  pendientes: number;
  en_progreso: number;
  completadas: number;
  vencidas: number;
}

export interface DashboardProgreso {
  tareas_totales: number;
  tareas_completadas: number;
  porcentaje_completado: number;
  materias_activas: number;
}

/**
 * Contrato de notificaciones del panel.
 * HU18 completará el módulo; hasta entonces el backend responde una lista vacía.
 */
export interface DashboardNotificacion {
  id: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion: string;
}

/**
 * Resumen académico agregado del usuario autenticado (HU06).
 * Todas las listas ya vienen filtradas por RLS y por `usuario_id` en el backend.
 */
export interface DashboardResumen {
  materias: DashboardMateriasResumen;
  tareas: DashboardTareasResumen;
  proximas_actividades: Tarea[];
  proximos_examenes: Tarea[];
  proximos_eventos: EventoCalendario[];
  progreso: DashboardProgreso;
  notificaciones: DashboardNotificacion[];
  generado_en: string;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);

  obtenerResumen(): Observable<DashboardResumen> {
    return this.api.get<DashboardResumen>('/dashboard');
  }
}
