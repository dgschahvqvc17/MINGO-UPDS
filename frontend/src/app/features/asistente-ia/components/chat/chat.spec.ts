import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import type { Conversacion } from '../../../../core/models/dominio.models';
import { ChatService, type RespuestaChat } from '../../../../core/services/chat.service';
import { DocumentoService, type Documento } from '../../../../core/services/documento.service';
import { MateriaService, type Materia } from '../../../../core/services/materia.service';
import { ChatComponent } from './chat.component';

const CONVERSACION_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const MATERIA_OTRA_ID = '3f2e1d0c-9b8a-4f7e-8d6c-5b4a3928170f';
const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
const DOCUMENTO_OTRO_ID = '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

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

function crearMateria(id: string, nombre: string): Materia {
  return {
    id,
    usuario_id: 'usuario-1',
    nombre,
    codigo: nombre.slice(0, 4).toUpperCase(),
    docente: 'Docente',
    docente_id: null,
    descripcion: null,
    periodo_academico: '2026-1',
    color: '#0d6efd',
    estado: 'activo',
    fecha_creacion: '2026-01-01T00:00:00.000Z',
    fecha_actualizacion: null,
    total_tareas: 0,
    tareas_pendientes: 0,
    total_documentos: 1,
  };
}

function crearDocumento(id: string, nombre: string, materiaId: string): Documento {
  return {
    id,
    usuario_id: 'usuario-1',
    materia_id: materiaId,
    unidad_id: null,
    nombre,
    nombre_archivo: `${nombre}.pdf`,
    ruta_almacenamiento: `usuarios/usuario-1/documentos/${id}/original`,
    tipo_archivo: 'application/pdf',
    tamano: 1024,
    estado_procesamiento: 'procesado',
    motivo_error: null,
    numero_paginas: 1,
    fecha_carga: '2026-01-01T00:00:00.000Z',
    fecha_actualizacion: null,
  };
}

const materias = [
  crearMateria(MATERIA_ID, 'Cálculo'),
  crearMateria(MATERIA_OTRA_ID, 'Historia'),
];
const documentos = [
  crearDocumento(DOCUMENTO_ID, 'Apuntes de cálculo', MATERIA_ID),
  crearDocumento(DOCUMENTO_OTRO_ID, 'Apuntes de historia', MATERIA_OTRA_ID),
];

const listar = vi.fn();
const obtener = vi.fn();
const enviar = vi.fn();
const eliminar = vi.fn();
const listarDocumentos = vi.fn();
const listarMaterias = vi.fn();

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
    listarMaterias.mockReset().mockReturnValue(of({ success: true, data: [], meta: {} }));

    TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        { provide: ChatService, useValue: { listar, obtener, enviar, eliminar } },
        { provide: DocumentoService, useValue: { listar: listarDocumentos } },
        { provide: MateriaService, useValue: { listarMaterias } },
      ],
    });

    fixture = TestBed.createComponent(ChatComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga las conversaciones, los documentos y las materias al iniciar', () => {
    expect(listar).toHaveBeenCalledWith(20, 0);
    expect(listarDocumentos).toHaveBeenCalledWith({ estado: 'procesado', limit: 100 });
    expect(listarMaterias).toHaveBeenCalledWith({ limit: 100 });
    expect(componente.conversaciones()).toEqual([conversacion]);
  });

  it('muestra las materias del usuario en el selector de fuentes', () => {
    listarMaterias.mockReturnValue(of({ success: true, data: materias, meta: {} }));
    componente.cargarMaterias();
    fixture.detectChanges();

    const selector = fixture.nativeElement.querySelector('#materia-chat') as HTMLSelectElement;
    expect(Array.from(selector.options).map((opcion) => opcion.textContent?.trim())).toEqual([
      'Todas las materias',
      'Cálculo',
      'Historia',
    ]);
  });

  it('filtra los documentos por la materia elegida y limpia la selección anterior', () => {
    listarDocumentos.mockReturnValue(of({ documentos, paginacion: { limit: 100, offset: 0, total: 2 } }));
    listarMaterias.mockReturnValue(of({ success: true, data: materias, meta: {} }));
    componente.cargarDocumentos();
    componente.cargarMaterias();
    componente.documentoIds.set([DOCUMENTO_OTRO_ID]);
    fixture.detectChanges();

    const selector = fixture.nativeElement.querySelector('#materia-chat') as HTMLSelectElement;
    selector.value = MATERIA_ID;
    selector.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(componente.materiaId()).toBe(MATERIA_ID);
    expect(componente.documentoIds()).toEqual([]);
    expect(componente.documentosFiltrados().map((documento) => documento.id)).toEqual([
      DOCUMENTO_ID,
    ]);

    const opciones = Array.from(
      (fixture.nativeElement.querySelector('#documentos-chat') as HTMLSelectElement).options,
    ).map((opcion) => opcion.value);
    expect(opciones).toEqual([DOCUMENTO_ID]);
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
    componente.materiaId.set(MATERIA_ID);
    componente.documentoIds.set([DOCUMENTO_ID]);
    componente.usarDocumentos.set(false);

    componente.enviar();
    fixture.detectChanges();

    expect(enviar).toHaveBeenCalledWith(
      {
        conversacion_id: null,
        mensaje: '¿Qué es una derivada?',
        materia_id: MATERIA_ID,
        documento_ids: [DOCUMENTO_ID],
        usar_documentos: false,
      },
      expect.any(String),
    );
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
      expect.any(String),
    );
  });

  it('muestra un icono en la cabecera y una mascota grande que invita a preguntar', () => {
    componente.mensajes.set([]);
    fixture.detectChanges();

    const cuerpoChat = fixture.nativeElement
      .querySelector('.chat-mensajes')
      .closest('.card-body') as HTMLElement;
    const cabecera = cuerpoChat.querySelector('.panel-heading') as HTMLElement;
    expect(cabecera.querySelector('.bi-chat-dots')).not.toBeNull();
    expect(cabecera.querySelector('app-mascota-agente')).toBeNull();

    const mascota = fixture.nativeElement.querySelector(
      '.chat-mensajes app-mascota-agente',
    ) as HTMLElement;
    expect(mascota.classList.contains('mascota--grande')).toBe(true);
    expect(mascota.querySelector('.mascota__burbuja')?.textContent).toContain(
      '¿Qué quieres preguntarme?',
    );
    expect(
      (mascota.querySelector('.mascota__seguimiento') as HTMLElement).style.transform,
    ).toBe('');
  });

  it('muestra la mascota pensando mientras espera y hablando al recibir la respuesta', () => {
    const respuestaPendiente = new Subject<RespuestaChat>();
    enviar.mockReturnValue(respuestaPendiente);
    componente.mensajeControl.setValue('¿Qué es una derivada?');

    componente.enviar();
    fixture.detectChanges();

    let mascota = fixture.nativeElement.querySelector(
      'app-mascota-agente .mascota',
    ) as HTMLElement;
    expect(mascota.classList.contains('mascota--pensando')).toBe(true);

    respuestaPendiente.next(respuesta);
    respuestaPendiente.complete();
    fixture.detectChanges();

    mascota = fixture.nativeElement.querySelector('app-mascota-agente .mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--hablando')).toBe(true);
    fixture.destroy();
  });

  it('devuelve la mascota a reposo cuando falla el envio', () => {
    enviar.mockReturnValue(throwError(() => ({})));
    componente.mensajeControl.setValue('¿Qué es una derivada?');

    componente.enviar();
    fixture.detectChanges();

    const mascota = fixture.nativeElement.querySelector(
      'app-mascota-agente .mascota',
    ) as HTMLElement;
    expect(mascota.classList.contains('mascota--inactivo')).toBe(true);
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

  it('reutiliza la Idempotency-Key al reintentar la misma solicitud', () => {
    enviar
      .mockReturnValueOnce(throwError(() => ({})))
      .mockReturnValueOnce(of(respuesta));
    componente.mensajeControl.setValue('¿Qué es una derivada?');

    componente.enviar();
    const claveDelPrimerIntento = enviar.mock.calls[0][1];
    componente.enviar();

    expect(claveDelPrimerIntento).toEqual(expect.any(String));
    expect(enviar.mock.calls[1][1]).toBe(claveDelPrimerIntento);
  });

  it('genera una clave nueva cuando cambia el contenido del mensaje', () => {
    enviar
      .mockReturnValueOnce(throwError(() => ({})))
      .mockReturnValueOnce(throwError(() => ({})));
    componente.mensajeControl.setValue('¿Qué es una derivada?');
    componente.enviar();

    componente.mensajeControl.setValue('¿Qué es una integral?');
    componente.enviar();

    expect(enviar.mock.calls[0][1]).not.toBe(enviar.mock.calls[1][1]);
  });

  it('inicia una conversacion nueva sin historial', () => {
    componente.seleccionarConversacion(conversacion);
    componente.nuevaConversacion();
    fixture.detectChanges();

    expect(componente.conversacionActualId()).toBeNull();
    expect(componente.mensajes()).toEqual([]);
  });
});
