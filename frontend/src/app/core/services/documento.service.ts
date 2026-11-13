import { HttpClient, HttpEventType } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map, filter } from 'rxjs';
import { ApiService } from './api.service';

export const ESTADOS_DOCUMENTO = ['pendiente', 'en_cola', 'procesando', 'procesado', 'error'] as const;

export type EstadoDocumento = (typeof ESTADOS_DOCUMENTO)[number];

/**
 * Limite de subida del cliente. Debe coincidir con MAX_UPLOAD_MB del backend
 * y con la restriccion de la tabla documentos (20 MB).
 */
export const TAMANO_MAXIMO_BYTES = 20 * 1024 * 1024;

export interface FormatoDocumento {
  mime: string;
  extensiones: string[];
  etiqueta: string;
}

/**
 * Formatos aceptados por el backend (config.uploads.allowedMimeTypes).
 * La extension debe coincidir con el MIME declarado.
 */
export const FORMATOS_DOCUMENTO: FormatoDocumento[] = [
  { mime: 'application/pdf', extensiones: ['.pdf'], etiqueta: 'PDF' },
  { mime: 'application/msword', extensiones: ['.doc'], etiqueta: 'DOC' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    extensiones: ['.docx'],
    etiqueta: 'DOCX',
  },
  { mime: 'application/vnd.ms-powerpoint', extensiones: ['.ppt'], etiqueta: 'PPT' },
  {
    mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    extensiones: ['.pptx'],
    etiqueta: 'PPTX',
  },
  { mime: 'text/plain', extensiones: ['.txt'], etiqueta: 'TXT' },
];

export const EXTENSIONES_ACEPTADAS = FORMATOS_DOCUMENTO.flatMap((formato) => formato.extensiones);

export interface DocumentoMateriaResumen {
  nombre: string;
  codigo: string;
  color: string;
}

export interface Documento {
  id: string;
  usuario_id: string;
  materia_id: string;
  unidad_id: string | null;
  nombre: string;
  nombre_archivo: string;
  ruta_almacenamiento: string;
  tipo_archivo: string;
  tamano: number;
  estado_procesamiento: EstadoDocumento;
  motivo_error: string | null;
  numero_paginas: number | null;
  fecha_carga: string;
  fecha_actualizacion: string | null;
  materias?: DocumentoMateriaResumen | DocumentoMateriaResumen[] | null;
}

export interface PaginacionDocumentos {
  limit: number;
  offset: number;
  total: number;
}

export interface DocumentoListado {
  documentos: Documento[];
  paginacion: PaginacionDocumentos;
}

export interface DocumentoFiltros {
  materia_id?: string;
  q?: string;
  estado?: EstadoDocumento;
  limit?: number;
  offset?: number;
}

export interface SolicitudUrlCarga {
  nombre_archivo: string;
  tipo_archivo: string;
  tamano: number;
  materia_id: string;
}

export interface RespuestaUrlCarga {
  uploadUrl: string;
  objectKey: string;
  expiresInSeconds: number;
  maxSizeBytes: number;
}

export interface RegistroDocumento {
  objectKey: string;
  nombre: string;
  materia_id: string;
  unidad_id?: string | null;
}

export interface RespuestaDescarga {
  downloadUrl: string;
  nombreArchivo: string;
  tipoArchivo: string;
  expiresInSeconds: number;
}

/**
 * Servicio de documentos academicos (HU07 y HU08).
 * La subida va directo del navegador a S3 con una URL prefirmada; la API solo
 * firma las URLs y registra metadatos.
 */
@Injectable({ providedIn: 'root' })
export class DocumentoService {
  private readonly api = inject(ApiService);
  private readonly http = inject(HttpClient);

  listar(filtros: DocumentoFiltros = {}): Observable<DocumentoListado> {
    return this.api
      .getWithMeta<Documento[], { paginacion: PaginacionDocumentos }>('/documentos', {
        materia_id: filtros.materia_id,
        q: filtros.q,
        estado: filtros.estado,
        limit: filtros.limit,
        offset: filtros.offset,
      })
      .pipe(
        map(({ data, meta }) => ({
          documentos: data ?? [],
          paginacion: meta.paginacion,
        })),
      );
  }

  obtener(id: string): Observable<Documento> {
    return this.api.get<Documento>(`/documentos/${encodeURIComponent(id)}`);
  }

  urlDescarga(id: string): Observable<RespuestaDescarga> {
    return this.api.get<RespuestaDescarga>(`/documentos/${encodeURIComponent(id)}/descarga`);
  }

  eliminar(id: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(`/documentos/${encodeURIComponent(id)}`);
  }

  solicitarUrlCarga(datos: SolicitudUrlCarga): Observable<RespuestaUrlCarga> {
    return this.api.post<RespuestaUrlCarga>('/documentos/url-carga', datos);
  }

  registrar(datos: RegistroDocumento): Observable<Documento> {
    return this.api.post<Documento>('/documentos', datos);
  }

  /**
   * Sube el archivo directamente a S3 y reporta el progreso (0-100).
   * El interceptor de autenticacion no interviene: la URL ya esta firmada.
   */
  subirArchivo(url: string, archivo: File): Observable<number> {
    return this.http
      .put(url, archivo, {
        headers: { 'Content-Type': archivo.type },
        observe: 'events',
        reportProgress: true,
        responseType: 'text',
      })
      .pipe(
        filter((evento) => evento.type === HttpEventType.UploadProgress),
        map((evento) => {
          const total = evento.total ?? archivo.size;
          return total > 0 ? Math.round((evento.loaded / total) * 100) : 0;
        }),
      );
  }

  obtenerFormato(mime: string): FormatoDocumento | undefined {
    return FORMATOS_DOCUMENTO.find((formato) => formato.mime === mime);
  }

  obtenerFormatoPorNombre(nombreArchivo: string): FormatoDocumento | undefined {
    const extension = this.obtenerExtension(nombreArchivo);
    return FORMATOS_DOCUMENTO.find((formato) => formato.extensiones.includes(extension));
  }

  obtenerExtension(nombreArchivo: string): string {
    const posicionPunto = nombreArchivo.lastIndexOf('.');
    return posicionPunto > 0 ? nombreArchivo.slice(posicionPunto).toLowerCase() : '';
  }

  estadoTexto(estado: EstadoDocumento): string {
    const textos: Record<EstadoDocumento, string> = {
      pendiente: 'Pendiente',
      en_cola: 'En cola',
      procesando: 'Procesando',
      procesado: 'Procesado',
      error: 'Error',
    };

    return textos[estado];
  }

  estadoClase(estado: EstadoDocumento): string {
    const clases: Record<EstadoDocumento, string> = {
      pendiente: 'doc-badge--muted',
      en_cola: 'doc-badge--info',
      procesando: 'doc-badge--info',
      procesado: 'doc-badge--success',
      error: 'doc-badge--danger',
    };

    return clases[estado];
  }

  formatoTexto(tipoArchivo: string, nombreArchivo: string): string {
    const formato = this.obtenerFormato(tipoArchivo);
    if (formato) {
      return formato.etiqueta;
    }

    const extension = this.obtenerExtension(nombreArchivo);
    return extension ? extension.replace('.', '').toUpperCase() : 'Desconocido';
  }

  formatearTamano(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
}
