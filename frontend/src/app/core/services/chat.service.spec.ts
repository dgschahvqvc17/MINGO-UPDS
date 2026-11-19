import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatService, type RespuestaChat } from './chat.service';

const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const respuesta: RespuestaChat = {
  conversacion_id: CONVERSACION_ID,
  mensaje_id: 'mensaje-2',
  respuesta: 'Según tus documentos, la derivada mide la tasa de cambio.',
  modelo: 'gpt-4o-mini',
  referencias: [
    {
      documento_id: DOCUMENTO_ID,
      documento_nombre: 'Apuntes de cálculo',
      fragmento_id: 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f',
      numero_pagina: 12,
      extracto: 'La derivada mide la tasa de cambio instantánea.',
    },
  ],
  consumo: { tokens_entrada: 120, tokens_salida: 40 },
};

describe('ChatService (HU12)', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ChatService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('envia la pregunta con el contrato del backend', () => {
    service
      .enviar({
        conversacion_id: null,
        mensaje: '¿Qué es una derivada?',
        materia_id: null,
        documento_ids: [DOCUMENTO_ID],
        usar_documentos: true,
      })
      .subscribe((resultado) => expect(resultado).toEqual(respuesta));

    const req = httpMock.expectOne('/api/asistente/chat');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      conversacion_id: null,
      mensaje: '¿Qué es una derivada?',
      materia_id: null,
      documento_ids: [DOCUMENTO_ID],
      usar_documentos: true,
    });
    req.flush({ success: true, data: respuesta });
  });

  it('lista las conversaciones con paginacion y metadatos', () => {
    service.listar(5, 10).subscribe((resultado) => {
      expect(resultado.data).toEqual([]);
      expect(resultado.meta).toEqual({ page: 3, limit: 5, total: 0, totalPages: 0 });
    });

    const req = httpMock.expectOne('/api/asistente/conversaciones?limit=5&offset=10');
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      data: [],
      meta: { page: 3, limit: 5, total: 0, totalPages: 0 },
    });
  });

  it('obtiene el historial de una conversacion', () => {
    service.obtener(CONVERSACION_ID).subscribe((resultado) => {
      expect(resultado.id).toBe(CONVERSACION_ID);
      expect(resultado.mensajes).toEqual([]);
    });

    const req = httpMock.expectOne(`/api/asistente/conversaciones/${CONVERSACION_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: { id: CONVERSACION_ID, mensajes: [] } });
  });

  it('elimina una conversacion por su identificador', () => {
    service.eliminar(CONVERSACION_ID).subscribe((resultado) => {
      expect(resultado).toEqual({ id: CONVERSACION_ID });
    });

    const req = httpMock.expectOne(`/api/asistente/conversaciones/${CONVERSACION_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: CONVERSACION_ID } });
  });
});
