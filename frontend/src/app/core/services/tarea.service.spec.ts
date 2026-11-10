import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TareaService, type MateriaResumenTarea, type Tarea } from './tarea.service';

const materiaResumen: MateriaResumenTarea = {
  nombre: 'Cálculo',
  codigo: 'MAT101',
  color: '#3B82F6',
};

const mockTarea: Tarea = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  usuario_id: '550e8400-e29b-41d4-a716-446655440001',
  materia_id: '550e8400-e29b-41d4-a716-446655440002',
  titulo: 'Resolver taller de derivadas',
  descripcion: 'Ejercicios del capítulo 3',
  tipo: 'taller',
  prioridad: 'alta',
  fecha_asignacion: '2026-11-10T00:00:00.000Z',
  fecha_entrega: '2026-11-15T23:59:59.000Z',
  estado: 'pendiente',
  fecha_creacion: '2026-11-10T10:00:00.000Z',
  fecha_actualizacion: null,
  materias: materiaResumen,
};

describe('TareaService', () => {
  let service: TareaService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TareaService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(TareaService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('lista las tareas con filtros y paginación', () => {
    const paginacion = { limit: 9, offset: 0, total: 1 };

    service.listarTareas({ estado: 'pendiente', limit: 9, offset: 0 }).subscribe((resultado) => {
      expect(resultado.tareas).toHaveLength(1);
      expect(resultado.tareas[0].titulo).toBe(mockTarea.titulo);
      expect(resultado.paginacion).toEqual(paginacion);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/tareas');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('estado')).toBe('pendiente');
    expect(req.request.params.get('limit')).toBe('9');
    expect(req.request.params.get('offset')).toBe('0');
    req.flush({ success: true, data: [mockTarea], meta: { paginacion } });
  });

  it('lista las próximas tareas con su rango', () => {
    const rango = {
      dias: 7,
      desde: '2026-11-10T00:00:00.000Z',
      hasta: '2026-11-17T00:00:00.000Z',
    };

    service.listarProximas(7, 5).subscribe((resultado) => {
      expect(resultado.tareas).toHaveLength(1);
      expect(resultado.rango).toEqual(rango);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/tareas/proximas');
    expect(req.request.params.get('dias')).toBe('7');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ success: true, data: [mockTarea], meta: { total: 1, rango } });
  });

  it('crea una tarea con los datos enviados', () => {
    const input = {
      materia_id: mockTarea.materia_id,
      titulo: mockTarea.titulo,
      tipo: mockTarea.tipo,
      prioridad: mockTarea.prioridad,
    };

    service.crearTarea(input).subscribe((tarea) => {
      expect(tarea.id).toBe(mockTarea.id);
    });

    const req = httpMock.expectOne('/api/tareas');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ success: true, data: mockTarea });
  });

  it('cambia el estado de una tarea', () => {
    service.cambiarEstadoTarea(mockTarea.id, 'completada').subscribe((tarea) => {
      expect(tarea.estado).toBe('pendiente');
    });

    const req = httpMock.expectOne(`/api/tareas/${mockTarea.id}/estado`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ estado: 'completada' });
    req.flush({ success: true, data: mockTarea });
  });

  it('elimina una tarea', () => {
    service.eliminarTarea(mockTarea.id).subscribe();

    const req = httpMock.expectOne(`/api/tareas/${mockTarea.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: mockTarea.id } });
  });

  it('detecta tareas vencidas sin contar las completadas', () => {
    const ayer = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    expect(service.esTareaVencida({ fecha_entrega: ayer, estado: 'pendiente' })).toBe(true);
    expect(service.esTareaVencida({ fecha_entrega: ayer, estado: 'completada' })).toBe(false);
    expect(service.esTareaVencida({ fecha_entrega: null, estado: 'pendiente' })).toBe(false);
  });

  it('convierte fechas del input al formato ISO esperado', () => {
    expect(service.aFechaAsignacionIso('2026-11-10')).toBe('2026-11-10T00:00:00.000Z');
    expect(service.aFechaEntregaIso('2026-11-10')).toBe('2026-11-10T23:59:59.000Z');
    expect(service.aFechaInput('2026-11-10T23:59:59.000Z')).toBe('2026-11-10');
    expect(service.aFechaInput(null)).toBe('');
  });

  it('obtiene la materia asociada a una tarea', () => {
    expect(service.obtenerMateriaDeTarea(mockTarea)?.nombre).toBe('Cálculo');
    expect(
      service.obtenerMateriaDeTarea({ ...mockTarea, materias: [materiaResumen] })?.codigo,
    ).toBe('MAT101');
    expect(service.obtenerMateriaDeTarea({ ...mockTarea, materias: null })).toBeNull();
  });
});
