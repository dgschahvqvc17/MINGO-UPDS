import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProgresoService } from './progreso.service';
import type { Objetivo, Progreso } from '../models/progreso.model';

const OBJETIVO_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';

const objetivo: Objetivo = {
  id: OBJETIVO_ID,
  usuario_id: 'usuario-1',
  materia_id: null,
  titulo: 'Aprobar el parcial de cálculo',
  descripcion: null,
  fecha_limite: '2026-12-10',
  estado: 'pendiente',
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  fecha_actualizacion: null,
  materias: null,
};

const progreso: Progreso = {
  materias_activas: 2,
  tareas_pendientes: 1,
  tareas_completadas: 3,
  cumplimiento_tareas: 0.75,
  sesiones_totales: 4,
  sesiones_completadas: 2,
  cumplimiento_sesiones: 0.5,
  minutos_estudiados: 120,
  cuestionarios_completados: 1,
  promedio_cuestionarios: 80,
  objetivos_activos: 1,
  objetivos_completados: 1,
  cumplimiento_objetivos: 0.5,
  racha_dias: 3,
  por_estado: {
    tareas: [],
    objetivos: [],
    sesiones: [],
  },
  actividad_semanal: [],
  actividades_atencion: [],
  recomendaciones: [],
  generado_en: '2026-11-19T10:00:00.000Z',
};

describe('ProgresoService (HU17)', () => {
  let service: ProgresoService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProgresoService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(ProgresoService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('lista objetivos con filtro y paginación', () => {
    service
      .listarObjetivos({ estado: 'pendiente', limit: 20, offset: 5 })
      .subscribe(({ objetivos, total }) => {
        expect(objetivos).toEqual([objetivo]);
        expect(total).toBe(1);
      });

    const peticion = httpMock.expectOne(
      (req) =>
        req.url.endsWith('/estudio/objetivos') &&
        req.params.get('estado') === 'pendiente' &&
        req.params.get('limit') === '20' &&
        req.params.get('offset') === '5',
    );
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ success: true, data: [objetivo], meta: { limit: 20, offset: 5, total: 1 } });
  });

  it('crea un objetivo en el endpoint correcto', () => {
    service
      .crearObjetivo({ titulo: objetivo.titulo, fecha_limite: '2026-12-10' })
      .subscribe((creado) => expect(creado).toEqual(objetivo));

    const peticion = httpMock.expectOne((req) =>
      req.url.endsWith('/estudio/objetivos') && req.method === 'POST',
    );
    expect(peticion.request.body).toEqual({
      titulo: objetivo.titulo,
      fecha_limite: '2026-12-10',
    });
    peticion.flush({ success: true, data: objetivo });
  });

  it('actualiza y elimina un objetivo por identificador', () => {
    service
      .actualizarObjetivo(OBJETIVO_ID, { estado: 'completada' })
      .subscribe((actualizado) => expect(actualizado.estado).toBe('completada'));
    service.eliminarObjetivo(OBJETIVO_ID).subscribe();

    const actualizacion = httpMock.expectOne((req) =>
      req.url.endsWith(`/estudio/objetivos/${OBJETIVO_ID}`) && req.method === 'PUT',
    );
    expect(actualizacion.request.body).toEqual({ estado: 'completada' });
    actualizacion.flush({ success: true, data: { ...objetivo, estado: 'completada' } });

    const eliminacion = httpMock.expectOne((req) =>
      req.url.endsWith(`/estudio/objetivos/${OBJETIVO_ID}`) && req.method === 'DELETE',
    );
    eliminacion.flush({ success: true, data: null });
  });

  it('obtiene el progreso agregado', () => {
    service.obtenerProgreso().subscribe((datos) => expect(datos).toEqual(progreso));

    const peticion = httpMock.expectOne((req) => req.url.endsWith('/estudio/progreso'));
    expect(peticion.request.method).toBe('GET');
    peticion.flush({ success: true, data: progreso });
  });
});
