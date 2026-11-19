import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export const PROFUNDIDADES_RESUMEN = ['breve', 'media', 'detallada'] as const;

export type ProfundidadResumen = (typeof PROFUNDIDADES_RESUMEN)[number];

export interface ConceptoImportante {
  termino: string;
  descripcion: string;
}

export interface ResumenDocumento {
  id: string | null;
  documento_id: string;
  documento_nombre: string;
  profundidad: ProfundidadResumen;
  resumen_general: string;
  temas_principales: string[];
  conceptos_importantes: ConceptoImportante[];
  modelo: string;
  tokens_entrada: number;
  tokens_salida: number;
  contenido_truncado: boolean;
  guardado: boolean;
  reutilizado: boolean;
  fecha_creacion: string | null;
}

export interface SolicitudResumen {
  documento_id: string;
  profundidad: ProfundidadResumen;
  guardar: boolean;
}

/** Servicio HTTP de los resumenes inteligentes (HU10). */
@Injectable({ providedIn: 'root' })
export class ResumenService {
  private readonly api = inject(ApiService);

  generar(solicitud: SolicitudResumen): Observable<ResumenDocumento> {
    return this.api.post<ResumenDocumento>('/asistente/resumen', solicitud);
  }

  obtenerGuardado(documentoId: string): Observable<ResumenDocumento | null> {
    return this.api.get<ResumenDocumento | null>(
      `/asistente/resumen/${encodeURIComponent(documentoId)}`,
    );
  }

  etiquetaProfundidad(profundidad: ProfundidadResumen): string {
    const etiquetas: Record<ProfundidadResumen, string> = {
      breve: 'Breve',
      media: 'Media',
      detallada: 'Detallada',
    };

    return etiquetas[profundidad];
  }
}
