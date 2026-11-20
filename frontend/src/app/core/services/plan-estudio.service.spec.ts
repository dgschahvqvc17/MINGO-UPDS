import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  PlanEstudioService,
  type ConfirmarPlanInput,
  type PlanesListado,
} from './plan-estudio.service';
import type { PlanEstudioDetalle, PropuestaPlan } from '../models/plan-estudio.model';

const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const PLAN_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';
const SESION_ID = 'c8f4b3d2-0e5a-4f7b-9c3d-4e2a6b8f0d13';

const propuesta: PropuestaPlan = {
  es_propuesta: true,
  materia_id: MATERIA_ID,
  materia_nombre: 'Sistemas Operativos',
  objetivo: 'Aprobar el parcial',
  fecha_examen: '2026-12-10',
  minutos_por_dia: 60,
  dias_disponibles: ['lunes'],
  resumen: 'Dos sesiones de repaso',
  sesiones: [
    {
      tema: 'Planificación de CPU',
      actividades: 'Leer el capítulo 3',
      fecha_inicio: '2026-12-01T09:00:00.000Z',
      duracion_minutos: 60,
      tipo: 'lectura',
    },
  ],
  modelo: 'modelo-de-prueba',
  tokens_entrada: 100,
  tokens_salida: 50,
};

const plan: PlanEstudioDetalle = {
  id: PLAN_ID,
  usuario_id: 'usuario-1',
  materia_id: MATERIA_ID,
  materia_nombre: 'Sistemas Operativos',
  materia_codigo: 'SIS-204',
  objetivo: 'Aprobar el parcial',
  fecha_examen: '2026-12-10',
  minutos_por_dia: 60,
  dias_disponibles: ['lunes'],
  estado: 'confirmado',
  modelo: 'modelo-de-prueba',
  tokens_entrada: 100,
  tokens_salida: 50,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  fecha_actualizacion: null,
  sesiones: [
    {
      id: SESION_ID,
      plan_id: PLAN_ID,
      evento_calendario_id: 'evento-1',
      tema: 'Planificación de CPU',
      actividades: 'Leer el capítulo 3',
      fecha_inicio: '2026-12-01T09:00:00.000Z',
      duracion_minutos: 60,
      tipo: 'lectura',
      orden: 1,
      estado: 'pendiente',
      fecha_creacion: '2026-11-19T10:00:00.000Z',
      fecha_actualizacion: null,
    },
  ],
};

describe('PlanEstudioService (HU15)', () => {
  let service: PlanEstudioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PlanEstudioService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(PlanEstudioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('solicita una propuesta sin guardarla', () => {
    const solicitud = {
      materia_id: MATERIA_ID,
      objetivo: 'Aprobar el parcial',
      fecha_examen: '2026-12-10',
      minutos_por_dia: 60,
      dias_disponibles: ['lunes' as const],
    };

    service.proponer(solicitud).subscribe((resultado) => {
      expect(resultado.es_propuesta).toBe(true);
      expect(resultado.sesiones).toHaveLength(1);
    });

    const req = httpMock.expectOne('/api/asistente/plan');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(solicitud);
    req.flush({ success: true, data: propuesta });
  });

  it('confirma un plan con sus sesiones', () => {
    const entrada: ConfirmarPlanInput = {
      ...propuesta,
      sesiones: propuesta.sesiones.map((sesion) => ({
        tema: sesion.tema,
        actividades: sesion.actividades,
        fecha_inicio: sesion.fecha_inicio,
        duracion_minutos: sesion.duracion_minutos,
        tipo: sesion.tipo,
      })),
    };

    service.confirmar(entrada).subscribe((resultado) => {
      expect(resultado.id).toBe(PLAN_ID);
    });

    const req = httpMock.expectOne('/api/estudio/planes');
    expect(req.request.method).toBe('POST');
    expect(req.request.body.sesiones).toHaveLength(1);
    req.flush({ success: true, data: plan });
  });

  it('lista planes usando el total del metadato', () => {
    let resultadoListado: PlanesListado | null = null;

    service.listar({ limit: 20, offset: 0 }).subscribe((resultado) => {
      resultadoListado = resultado;
    });

    const req = httpMock.expectOne('/api/estudio/planes?limit=20&offset=0');
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: [plan], meta: { total: 3 } });

    expect(resultadoListado).toEqual({ planes: [plan], total: 3 });
  });

  it('obtiene el detalle de un plan', () => {
    service.obtener(PLAN_ID).subscribe((resultado) => {
      expect(resultado.sesiones).toHaveLength(1);
    });

    const req = httpMock.expectOne(`/api/estudio/planes/${PLAN_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: plan });
  });

  it('actualiza los datos editables de un plan', () => {
    const cambios = {
      objetivo: 'Aprobar el final',
      fecha_examen: '2026-12-15',
      minutos_por_dia: 90,
      dias_disponibles: ['martes' as const, 'jueves' as const],
    };

    service.actualizar(PLAN_ID, cambios).subscribe((resultado) => {
      expect(resultado.objetivo).toBe(cambios.objetivo);
    });

    const req = httpMock.expectOne(`/api/estudio/planes/${PLAN_ID}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(cambios);
    req.flush({ success: true, data: { ...plan, ...cambios } });
  });

  it('cambia el estado de una sesión', () => {
    service.actualizarSesion(SESION_ID, { estado: 'completada' }).subscribe((resultado) => {
      expect(resultado.estado).toBe('completada');
    });

    const req = httpMock.expectOne(`/api/estudio/sesiones/${SESION_ID}`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'completada' });
    req.flush({
      success: true,
      data: { ...plan.sesiones[0], estado: 'completada' },
    });
  });

  it('descarta un plan', () => {
    service.descartar(PLAN_ID).subscribe((resultado) => {
      expect(resultado.estado).toBe('descartado');
    });

    const req = httpMock.expectOne(`/api/estudio/planes/${PLAN_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: PLAN_ID, estado: 'descartado' } });
  });
});
