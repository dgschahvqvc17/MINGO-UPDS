import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import type { Conversacion, Mensaje, ReferenciaRespuesta } from '../models/dominio.models';

export interface ReferenciaChat {
  documento_id: string;
  documento_nombre: string;
  fragmento_id: string;
  numero_pagina: number | null;
  extracto: string;
}

export interface ConsumoChat {
  tokens_entrada: number;
  tokens_salida: number;
}

export interface RespuestaChat {
  conversacion_id: string;
  mensaje_id: string;
  respuesta: string;
  modelo: string | null;
  referencias: ReferenciaChat[];
  consumo: ConsumoChat;
}

export interface SolicitudChat {
  conversacion_id: string | null;
  mensaje: string;
  materia_id: string | null;
  documento_ids: string[];
  usar_documentos: boolean;
}

export interface ConversacionConMensajes extends Conversacion {
  mensajes: (Mensaje & { referencias: ReferenciaRespuesta[] })[];
}

export interface MetaConversaciones {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Servicio HTTP del chat academico con RAG (HU12). */
@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly api = inject(ApiService);

  enviar(solicitud: SolicitudChat): Observable<RespuestaChat> {
    return this.api.post<RespuestaChat>('/asistente/chat', solicitud);
  }

  listar(
    limit = 20,
    offset = 0,
  ): Observable<{ data: Conversacion[]; meta: MetaConversaciones }> {
    return this.api.getWithMeta<Conversacion[], MetaConversaciones>(
      '/asistente/conversaciones',
      { limit, offset },
    );
  }

  obtener(conversacionId: string): Observable<ConversacionConMensajes> {
    return this.api.get<ConversacionConMensajes>(
      `/asistente/conversaciones/${encodeURIComponent(conversacionId)}`,
    );
  }

  eliminar(conversacionId: string): Observable<{ id: string }> {
    return this.api.delete<{ id: string }>(
      `/asistente/conversaciones/${encodeURIComponent(conversacionId)}`,
    );
  }
}
