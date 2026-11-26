import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  CuestionarioService,
  type CuestionarioResumen,
  type IntentoIniciado,
  type ResultadoIntento,
} from '../../../../core/services/cuestionario.service';
import { CuestionarioResolverComponent } from './cuestionario-resolver';

const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const INTENTO_ID = 'f1e2d3c4-b5a6-4c7d-8e9f-0a1b2c3d4e5f';
const PREGUNTA_ID = '11111111-1111-4111-8111-111111111111';
const ABIERTA_ID = '22222222-2222-4222-8222-222222222222';

const cuestionario: CuestionarioResumen = {
  id: CUESTIONARIO_ID,
  usuario_id: 'usuario-1',
  materia_id: null,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: null,
  titulo: 'Repaso de cálculo',
  dificultad: 'intermedia',
  cantidad_preguntas: 2,
  tipos: ['opcion_multiple', 'abierta'],
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 800,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  publicado: false,
  fecha_publicacion: null,
};

const intento = {
  id: INTENTO_ID,
  cuestionario_id: CUESTIONARIO_ID,
  estado: 'en_progreso' as const,
  total_preguntas: 2,
  preguntas_objetivas: 1,
  respuestas_correctas: 0,
  puntuacion: null,
  fecha_inicio: '2026-11-19T10:05:00.000Z',
  fecha_finalizacion: null,
};

const iniciado: IntentoIniciado = {
  intento,
  cuestionario: {
    ...cuestionario,
    preguntas: [
      {
        id: PREGUNTA_ID,
        cuestionario_id: CUESTIONARIO_ID,
        orden: 1,
        enunciado: '¿Qué mide la derivada?',
        tipo_pregunta: 'opcion_multiple',
        opciones: [
          { id: 'opcion-1', contenido: 'La tasa de cambio', orden: 1 },
          { id: 'opcion-2', contenido: 'El área', orden: 2 },
        ],
        respuesta_usuario: null,
        es_correcta: null,
      },
      {
        id: ABIERTA_ID,
        cuestionario_id: CUESTIONARIO_ID,
        orden: 2,
        enunciado: 'Explica la continuidad.',
        tipo_pregunta: 'abierta',
        opciones: [],
        respuesta_usuario: null,
        es_correcta: null,
      },
    ],
  },
};

const resultado: ResultadoIntento = {
  intento: {
    ...intento,
    estado: 'finalizado',
    respuestas_correctas: 2,
    puntuacion: 95,
    retroalimentacion_general: 'Buena base conceptual; repasa el concepto de límite.',
    temas_reforzar: ['Derivadas'],
    recomendaciones: ['Repasa el concepto de límite antes de volver a intentarlo.'],
    dominio_por_tema: [
      { tema: 'Derivadas', dominio: 0, aciertos: 0, total: 1 },
      { tema: 'Continuidad', dominio: 90, aciertos: 0.9, total: 1 },
    ],
    fecha_finalizacion: '2026-11-19T10:10:00.000Z',
  },
  cuestionario,
  preguntas: [
    {
      id: PREGUNTA_ID,
      cuestionario_id: CUESTIONARIO_ID,
      orden: 1,
      enunciado: '¿Qué mide la derivada?',
      tipo_pregunta: 'opcion_multiple',
      opciones: [
        { id: 'opcion-1', contenido: 'La tasa de cambio', orden: 1, es_correcta: true },
        { id: 'opcion-2', contenido: 'El área', orden: 2, es_correcta: false },
      ],
      respuesta_usuario: 'La tasa de cambio',
      es_correcta: true,
      respuesta_correcta: 'La tasa de cambio',
      explicacion: 'La derivada mide la tasa de cambio instantánea.',
    },
    {
      id: ABIERTA_ID,
      cuestionario_id: CUESTIONARIO_ID,
      orden: 2,
      enunciado: 'Explica la continuidad.',
      tipo_pregunta: 'abierta',
      tema: 'Continuidad',
      opciones: [],
      respuesta_usuario: 'Sin saltos.',
      es_correcta: true,
      respuesta_correcta: 'Una función sin cortes.',
      explicacion: 'La gráfica no se interrumpe.',
      evaluacion: {
        es_correcta: true,
        puntaje: 9,
        retroalimentacion: 'Explicaste la idea central con claridad.',
        criterios: [
          {
            nombre: 'precision_conceptual',
            cumplido: true,
            observacion: 'Uso correcto del concepto.',
          },
        ],
        temas_reforzar: ['Continuidad'],
      },
    },
  ],
};

describe('CuestionarioResolverComponent (HU13/HU16)', () => {
  let fixture: ComponentFixture<CuestionarioResolverComponent>;
  let componente: CuestionarioResolverComponent;
  const iniciarIntento = vi.fn();
  const responder = vi.fn();
  const obtenerIntento = vi.fn();

  beforeEach(() => {
    iniciarIntento.mockReset().mockReturnValue(of(iniciado));
    responder.mockReset().mockReturnValue(of(resultado));
    obtenerIntento.mockReset().mockReturnValue(of(resultado));

    TestBed.configureTestingModule({
      imports: [CuestionarioResolverComponent],
      providers: [
        {
          provide: CuestionarioService,
          useValue: { iniciarIntento, responder, obtenerIntento },
        },
      ],
    });

    fixture = TestBed.createComponent(CuestionarioResolverComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('cuestionarioId', CUESTIONARIO_ID);
    fixture.componentRef.setInput('titulo', 'Repaso de cálculo');
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('inicia el intento y muestra las preguntas sin respuestas correctas', () => {
    expect(iniciarIntento).toHaveBeenCalledWith(CUESTIONARIO_ID);
    expect(componente.preguntas()).toHaveLength(2);
    expect(componente.todasRespondidas()).toBe(false);

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('¿Qué mide la derivada?');
    expect(texto).not.toContain('Respuesta correcta:');
  });

  it('no envía el intento si faltan respuestas', () => {
    componente.seleccionar(PREGUNTA_ID, 'La tasa de cambio');
    componente.enviar();

    expect(componente.todasRespondidas()).toBe(false);
    expect(responder).not.toHaveBeenCalled();
  });

  it('envía todas las respuestas y muestra la puntuación con la corrección', () => {
    componente.seleccionar(PREGUNTA_ID, 'La tasa de cambio');
    componente.seleccionar(ABIERTA_ID, 'Una función sin saltos.');
    componente.enviar();
    fixture.detectChanges();

    expect(responder).toHaveBeenCalledWith(INTENTO_ID, [
      { pregunta_id: PREGUNTA_ID, respuesta: 'La tasa de cambio' },
      { pregunta_id: ABIERTA_ID, respuesta: 'Una función sin saltos.' },
    ]);
    expect(componente.puntuacion()).toBe(95);
    expect(fixture.nativeElement.textContent).toContain('95%');
    expect(fixture.nativeElement.textContent).toContain('Respuesta correcta:');
  });

  it('muestra la retroalimentación, los criterios y las recomendaciones de la evaluación', () => {
    componente.seleccionar(PREGUNTA_ID, 'La tasa de cambio');
    componente.seleccionar(ABIERTA_ID, 'Una función sin saltos.');
    componente.enviar();
    fixture.detectChanges();

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('Buena base conceptual');
    expect(texto).toContain('Evaluación de tu respuesta');
    expect(texto).toContain('Explicaste la idea central con claridad.');
    expect(texto).toContain('Precisión conceptual');
    expect(texto).toContain('Tu dominio por tema');
    expect(texto).toContain('Recomendaciones de repaso');
    expect(texto).toContain('Repasa el concepto de límite');
    expect(componente.evaluacionesAbiertas()).toHaveLength(1);
  });

  it('avisa cuando la evaluación de respuestas abiertas no estuvo disponible', () => {
    responder.mockReturnValue(of({ ...resultado, aviso_evaluacion: 'Límite diario alcanzado.' }));

    componente.seleccionar(PREGUNTA_ID, 'La tasa de cambio');
    componente.seleccionar(ABIERTA_ID, 'Una función sin saltos.');
    componente.enviar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Límite diario alcanzado.');
  });

  it('revisa un intento finalizado sin iniciar uno nuevo', () => {
    fixture.destroy();
    iniciarIntento.mockClear();
    fixture = TestBed.createComponent(CuestionarioResolverComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('cuestionarioId', CUESTIONARIO_ID);
    fixture.componentRef.setInput('intentoId', INTENTO_ID);
    fixture.detectChanges();

    expect(obtenerIntento).toHaveBeenCalledWith(INTENTO_ID);
    expect(iniciarIntento).not.toHaveBeenCalled();
    expect(componente.esRevision()).toBe(true);
    expect(componente.hayResultado()).toBe(true);
    expect(responder).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('Evaluación guardada');
  });

  it('muestra un error seguro si no se puede iniciar el intento', () => {
    iniciarIntento.mockReturnValue(throwError(() => new Error('Sin conexión')));

    componente.iniciar();
    fixture.detectChanges();

    expect(componente.cargando()).toBe(false);
    expect(componente.error()).toBe('Sin conexión');
    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
  });
});
