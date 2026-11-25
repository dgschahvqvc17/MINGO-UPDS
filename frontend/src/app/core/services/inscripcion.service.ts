import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiService } from './api.service';

export interface EstudianteResumen {
  id: string;
  nombre: string;
  apellido: string;
  correo?: string;
}

export interface Inscripcion {
  id: string;
  materia_id: string;
  estudiante_id: string;
  usuario_id: string;
  estado: 'activa' | 'inactiva';
  fecha_inscripcion: string;
  fecha_actualizacion: string | null;
  estudiante: EstudianteResumen | null;
}

export interface InscripcionMeta {
  total: number;
  limit: number;
  offset: number;
}

export interface InscripcionListado {
  inscripciones: Inscripcion[];
  total: number;
}

@Injectable({ providedIn: 'root' })
export class InscripcionService {
  private readonly api = inject(ApiService);

  listar(materiaId: string, limit = 50, offset = 0): Observable<InscripcionListado> {
    return this.api
      .getWithMeta<Inscripcion[], InscripcionMeta>(`materias/${materiaId}/inscripciones`, {
        limit,
        offset,
      })
      .pipe(
        map(({ data, meta }) => ({
          inscripciones: data ?? [],
          total: meta.total ?? data?.length ?? 0,
        })),
      );
  }

  inscribir(materiaId: string, usuarioId: string): Observable<Inscripcion> {
    return this.api.post<Inscripcion>(`materias/${materiaId}/inscripciones`, {
      usuario_id: usuarioId,
    });
  }

  desinscribir(materiaId: string, usuarioId: string): Observable<Inscripcion> {
    return this.api.delete<Inscripcion>(`materias/${materiaId}/inscripciones/${usuarioId}`);
  }
}
