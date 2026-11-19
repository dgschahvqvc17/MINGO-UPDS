import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import type { Conversacion } from '../../../../core/models/dominio.models';
import { ChatService, type RespuestaChat } from '../../../../core/services/chat.service';
import { DocumentoService } from '../../../../core/services/documento.service';
import { ChatComponent } from './chat.component';

const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const conversacion: Conversacion = {
  id: CONVERSACION_ID,
  usuario_id: 'usuario-1',
  titulo: '¿Qué es una derivada?',
  tipo_conversacion: 'academica',
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  fecha_actualizacion: '2026-11-19T10:00:00.000Z',
};

const respuesta: RespuestaChat = {
  conversacion_id: CONVERSACION_ID,
  mensaje_id: 'mensaje-2',
  respuesta: 'La derivada mide la tasa de cambio.',
  modelo: 'gpt-4o-mini',
  referencias: [
    {
      documento_id: DOCUMENTO_ID,
      documento_nombre: 'Apuntes de cálculo',
      fragmento_id: 'fragmento-1',
      numero_pagina: 12,
      extracto: 'La derivada mide la tasa de cambio instantánea.',
    },
  ],
  consumo: { tokens_entrada: 100, tokens_salida: 40 },
};

const listar = vi.fn();
const obtener = vi.fn();
const enviar = vi.fn();
const eliminar = vi.fn();
const listarDocumentos = vi.fn();

describe('ChatComponent (HU12)', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let componente: ChatComponent;

  beforeEach(() => {
    listar.mockReset().mockReturnValue(
      of({ data: [conversacion], meta: { page: 1, limit: 20, total: 1, totalPages: 1 } }),
    );
    obtener.mockReset().mockReturnValue(
      of({
        ...conversacion,
        mensajes: [
          {
            id: 'mensaje-1',
            conversacion_id: CONVERSACION_ID,
            rol_mensaje: 'user',
            contenido: '¿Qué es una derivada?',
            modelo_utilizado: null,
            fecha_creacion: '2026-11-19T10:00:00.000Z',
            referencias: [],
          },
          {
            id: 'mensaje-2',
            conversacion_id: CONVERSACION_ID,
            rol_mensaje: 'assistant',
            contenido: respuesta.respuesta,
            modelo_utilizado: 'gpt-4o-mini',
            fecha_creacion: '2026-11-19T10:00:01.000Z',
            referencias: respuesta.referencias,
          },
        ],
      }),
    );
    enviar.mockReset().mockReturnValue(of(respuesta));
    eliminar.mockReset().mockReturnValue(of({ id: CONVERSACION_ID }));
    listarDocumentos.mockReset().mockReturnValue(of({ documentos: [], total: 0 }));

    TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        { provide: ChatService, useValue: { listar, obtener, enviar, eliminar } },
        { provide: DocumentoService, useValue: { listar: listarDocumentos } },
      ],
    });

    fixture = TestBed.createComponent(ChatComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga las conversaciones y los documentos al iniciar', () => {
    expect(listar).toHaveBeenCalledWith(20, 0);
    expect(listarDocumentos).toHaveBeenCalledWith({ estado: 'procesado', limit: 100 });
    expect(componente.conversaciones()).toEqual([conversacion]);
  });

  it('muestra el estado vacio cuando no hay conversaciones', () => {
    listar.mockReturnValue(
      of({ data: [], meta: { page: 1, limit: 20, total: 0, totalPages: 0 } }),
    );
    componente.cargarConversaciones();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Todavía no tienes conversaciones.',
    );
  });

  it('carga el historial al seleccionar una conversacion', () => {
    componente.seleccionarConversacion(conversacion);
    fixture.detectChanges();

    expect(obtener).toHaveBeenCalledWith(CONVERSACION_ID);
    expect(componente.conversacionActualId()).toBe(CONVERSACION_ID);
    expect(fixture.nativeElement.textContent).toContain(respuesta.respuesta);
    expect(fixture.nativeElement.textContent).toContain('Apuntes de cálculo · pág. 12');
  });

  it('envia una pregunta con los filtros seleccionados', () => {
    componente.mensajeControl.setValue('¿Qué es una derivada?');
    componente.documentoIds.set([DOCUMENTO_ID]);
    componente.usarDocumentos.set(false);

    componente.enviar();
    fixture.detectChanges();

    expect(enviar).toHaveBeenCalledWith({
      conversacion_id: null,
      mensaje: '¿Qué es una derivada?',
      materia_id: null,
      documento_ids: [DOCUMENTO_ID],
      usar_documentos: false,
    });
    expect(obtener).toHaveBeenCalledWith(CONVERSACION_ID);
  });

  it('envia la pregunta al enviar el formulario sin recargar la pagina', () => {
    componente.mensajeControl.setValue('¿Qué es una derivada?');
    const formulario = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const evento = new Event('submit', { bubbles: true, cancelable: true });

    formulario.dispatchEvent(evento);
    fixture.detectChanges();

    expect(evento.defaultPrevented).toBe(true);
    expect(enviar).toHaveBeenCalledWith(
      expect.objectContaining({ mensaje: '¿Qué es una derivada?' }),
    );
  });

  it('muestra un error claro sin perder el mensaje cuando falla el envio', () => {
    enviar.mockReturnValue(throwError(() => ({})));
    componente.mensajeControl.setValue('¿Qué es una derivada?');

    componente.enviar();
    fixture.detectChanges();

    expect(componente.errorEnvio()).toContain('No se pudo enviar el mensaje.');
    expect(componente.mensajeControl.value).toBe('¿Qué es una derivada?');
    expect(componente.enviando()).toBe(false);
  });

  it('inicia una conversacion nueva sin historial', () => {
    componente.seleccionarConversacion(conversacion);
    componente.nuevaConversacion();
    fixture.detectChanges();

    expect(componente.conversacionActualId()).toBeNull();
    expect(componente.mensajes()).toEqual([]);
  });
});
