import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';
import {
  type EstadoObjetivo,
  type Objetivo,
  type Progreso,
} from '../models/progreso.model';

export interface ListadoObjetivos {
  objetivos: Objetivo[];
  total: number;
}

export interface MetaObjetivos {
  limit: number;
  offset: number;
  total: number;
}

export interface FiltroObjetivos {
  estado?: EstadoObjetivo;
  limit: number;
  offset: number;
}

export interface CrearObjetivoInput {
  titulo: string;
  descripcion?: string;
  materia_id?: string | null;
  fecha_limite?: string | null;
}

export interface ActualizarObjetivoInput {
  titulo?: string;
  descripcion?: string | null;
  materia_id?: string | null;
  fecha_limite?: string | null;
  estado?: EstadoObjetivo;
}

/** Servicio de dominio de HU17: objetivos académicos y progreso. */
@Injectable({ providedIn: 'root' })
export class ProgresoService {
  private readonly api = inject(ApiService);

  listarObjetivos(filtro: FiltroObjetivos): Observable<ListadoObjetivos> {
    return this.api
      .getWithMeta<Objetivo[], MetaObjetivos>('/estudio/objetivos', {
        ...(filtro.estado ? { estado: filtro.estado } : {}),
        limit: filtro.limit,
        offset: filtro.offset,
      })
      .pipe(
        // El sobre de la API devuelve los objetivos en `data` y el total en `meta`.
        // Se mantiene la forma del resto de servicios de la aplicación.
        map(({ data, meta }) => ({ objetivos: data, total: meta.total })),
      );
  }

  crearObjetivo(input: CrearObjetivoInput): Observable<Objetivo> {
    return this.api.post<Objetivo>('/estudio/objetivos', input);
  }

  actualizarObjetivo(id: string, cambios: ActualizarObjetivoInput): Observable<Objetivo> {
    return this.api.put<Objetivo>(`/estudio/objetivos/${id}`, cambios);
  }

  eliminarObjetivo(id: string): Observable<void> {
    return this.api.delete<void>(`/estudio/objetivos/${id}`);
  }

  obtenerProgreso(): Observable<Progreso> {
    return this.api.get<Progreso>('/estudio/progreso');
  }
}
