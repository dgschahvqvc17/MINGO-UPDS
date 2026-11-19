import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

/** Fragmento relevante devuelto por la búsqueda semántica (HU11). */
export interface FragmentoBusqueda {
  fragmento_id: string;
  documento_id: string;
  documento_nombre: string;
  contenido: string;
  numero_pagina: number | null;
  similitud: number;
}

export interface RespuestaBusqueda {
  resultados: FragmentoBusqueda[];
  mensaje: string | null;
}

export interface FiltrosBusqueda {
  documentoId?: string;
  materiaId?: string;
  limit?: number;
}

interface MetaBusqueda {
  mensaje: string | null;
}

/** Servicio HTTP de la búsqueda semántica de documentos (HU11). */
@Injectable({ providedIn: 'root' })
export class BusquedaService {
  private readonly api = inject(ApiService);

  buscar(consulta: string, filtros: FiltrosBusqueda = {}): Observable<RespuestaBusqueda> {
    return this.api
      .getWithMeta<FragmentoBusqueda[], MetaBusqueda>('/documentos/buscar', {
        q: consulta.trim(),
        documento_id: filtros.documentoId,
        materia_id: filtros.materiaId,
        limit: filtros.limit,
      })
      .pipe(
        map(({ data, meta }) => ({
          resultados: data ?? [],
          mensaje: meta?.mensaje ?? null,
        })),
      );
  }
}
