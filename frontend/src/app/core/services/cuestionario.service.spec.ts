import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { CuestionarioService, type CuestionarioResumen } from './cuestionario.service';

const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_ID = '11111111-1111-4111-8111-111111111111';

const cuestionario: CuestionarioResumen = {
  id: CUESTIONARIO_ID,
  usuario_id: 'usuario-1',
  materia_id: MATERIA_ID,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: null,
  titulo: 'Repaso de cálculo',
  dificultad: 'intermedia',
  cantidad_preguntas: 5,
  tipos: ['opcion_multiple'],
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 800,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  publicado: false,
  fecha_publicacion: null,
  fecha_inicio: null,
  fecha_limite: null,
};

describe('CuestionarioService (HU13)', () => {
  let service: CuestionarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CuestionarioService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CuestionarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('genera un cuestionario con el contrato del backend', () => {
    const solicitud = {
      materia_id: MATERIA_ID,
      documento_id: null,
      cantidad_preguntas: 5,
      dificultad: 'intermedia' as const,
      tipos: ['opcion_multiple'] as const,
    };

    service.generar({ ...solicitud, tipos: [...solicitud.tipos] }).subscribe();

    const req = httpMock.expectOne('/api/asistente/cuestionario');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(solicitud);
    req.flush({ success: true, data: { ...cuestionario, preguntas: [] } });
  });

  it('lista los cuestionarios y usa el total del metadato', () => {
    let total = 0;

    service.listar({ limit: 20, offset: 0 }).subscribe((resultado) => {
      total = resultado.total;
      expect(resultado.cuestionarios).toEqual([cuestionario]);
    });

    const req = httpMock.expectOne('/api/asistente/cuestionarios?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [cuestionario], meta: { total: 3 } });

    expect(total).toBe(3);
  });

  it('lista los cuestionarios disponibles y usa el total del metadato', () => {
    let total = 0;

    service.listarDisponibles({ limit: 10, offset: 0 }).subscribe((resultado) => {
      total = resultado.total;
      expect(resultado.cuestionarios).toEqual([cuestionario]);
    });

    const req = httpMock.expectOne('/api/asistente/cuestionarios/disponibles?limit=10&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [cuestionario], meta: { total: 4 } });

    expect(total).toBe(4);
  });

  it('cambia la publicación de un cuestionario con PATCH', () => {
    let publicado = false;

    service.publicar(CUESTIONARIO_ID, true).subscribe((resultado) => {
      publicado = resultado.publicado;
    });

    const req = httpMock.expectOne(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/publicacion`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ publicado: true });
    req.flush({ success: true, data: { ...cuestionario, publicado: true } });

    expect(publicado).toBe(true);
  });

  it('lista las calificaciones del cuestionario y usa el total del metadato', () => {
    const calificacion = {
      estudiante_id: 'estudiante-1',
      estudiante_nombre: 'Ana Torres',
      puntuacion: 92,
      estado: 'finalizado',
      fecha_inicio: '2026-11-19T10:05:00.000Z',
      fecha_finalizacion: '2026-11-19T10:10:00.000Z',
      respuestas_correctas: 9,
      total_preguntas: 10,
    };
    let total = 0;

    service.listarCalificaciones(CUESTIONARIO_ID, { limit: 20, offset: 0 }).subscribe((resultado) => {
      total = resultado.total;
      expect(resultado.calificaciones).toEqual([calificacion]);
    });

    const req = httpMock.expectOne(
      `/api/asistente/cuestionarios/${CUESTIONARIO_ID}/calificaciones?limit=20&offset=0`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [calificacion], meta: { total: 7 } });

    expect(total).toBe(7);
  });

  it('inicia un intento del cuestionario', () => {
    service.iniciarIntento(CUESTIONARIO_ID).subscribe();

    const req = httpMock.expectOne(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}/intentos`);
    expect(req.request.method).toBe('POST');
    req.flush({
      success: true,
      data: {
        intento: {
          id: INTENTO_ID,
          cuestionario_id: CUESTIONARIO_ID,
          estado: 'en_progreso',
          total_preguntas: 1,
          preguntas_objetivas: 1,
          respuestas_correctas: 0,
          puntuacion: null,
          fecha_inicio: '2026-11-19T10:05:00.000Z',
          fecha_finalizacion: null,
        },
        cuestionario: { ...cuestionario, preguntas: [] },
      },
    });
  });

  it('envía las respuestas del intento', () => {
    service
      .responder(INTENTO_ID, [{ pregunta_id: PREGUNTA_ID, respuesta: 'La derivada' }])
      .subscribe();

    const req = httpMock.expectOne(`/api/asistente/intentos/${INTENTO_ID}/responder`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      respuestas: [{ pregunta_id: PREGUNTA_ID, respuesta: 'La derivada' }],
    });
    req.flush({
      success: true,
      data: { intento: {}, cuestionario, preguntas: [] },
    });
  });

  it('consulta un intento y elimina un cuestionario', () => {
    service.obtenerIntento(INTENTO_ID).subscribe();
    httpMock
      .expectOne(`/api/asistente/intentos/${INTENTO_ID}`)
      .flush({ success: true, data: { intento: {}, cuestionario, preguntas: [] } });

    service.eliminar(CUESTIONARIO_ID).subscribe((resultado) =>
      expect(resultado).toEqual({ id: CUESTIONARIO_ID }),
    );
    const req = httpMock.expectOne(`/api/asistente/cuestionarios/${CUESTIONARIO_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: CUESTIONARIO_ID } });
  });

  it('lista el historial de evaluaciones y usa el total del metadato', () => {
    const intento = {
      id: INTENTO_ID,
      cuestionario_id: CUESTIONARIO_ID,
      estado: 'finalizado',
      total_preguntas: 2,
      preguntas_objetivas: 1,
      respuestas_correctas: 2,
      puntuacion: 95,
      retroalimentacion_general: 'Buen trabajo.',
      temas_reforzar: ['Derivadas'],
      recomendaciones: ['Repasa derivadas.'],
      dominio_por_tema: [],
      cuestionario_titulo: 'Repaso de cálculo',
      materia_nombre: 'Cálculo Diferencial',
      fecha_inicio: '2026-11-19T10:05:00.000Z',
      fecha_finalizacion: '2026-11-19T10:10:00.000Z',
    };
    let total = 0;

    service.listarIntentos({ limit: 10, offset: 0 }).subscribe((resultado) => {
      total = resultado.total;
      expect(resultado.intentos).toEqual([intento]);
    });

    const req = httpMock.expectOne('/api/asistente/intentos?limit=10&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [intento], meta: { total: 2 } });

    expect(total).toBe(2);
  });

  it('devuelve etiquetas legibles de tipo y dificultad', () => {
    expect(service.etiquetaTipo('opcion_multiple')).toBe('Opción múltiple');
    expect(service.etiquetaTipo('verdadero_falso')).toBe('Verdadero o falso');
    expect(service.etiquetaDificultad('avanzada')).toBe('Avanzada');
  });
});
