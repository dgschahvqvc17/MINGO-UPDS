import { TestBed } from '@angular/core/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import {
  CalendarioService,
  type EventoCalendario,
  type MateriaResumenEvento,
} from './calendario.service';

const materiaResumen: MateriaResumenEvento = {
  nombre: 'Cálculo',
  codigo: 'MAT101',
  color: '#3B82F6',
};

const mockEvento: EventoCalendario = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  usuario_id: '550e8400-e29b-41d4-a716-446655440001',
  materia_id: '550e8400-e29b-41d4-a716-446655440002',
  tarea_id: null,
  titulo: 'Examen parcial',
  descripcion: 'Unidades 1 a 3',
  tipo_evento: 'examen',
  fecha_inicio: '2026-11-20T14:00:00.000Z',
  fecha_fin: '2026-11-20T16:00:00.000Z',
  recordatorio: 60,
  fecha_creacion: '2026-11-10T10:00:00.000Z',
  fecha_actualizacion: null,
  materias: materiaResumen,
};

describe('CalendarioService', () => {
  let service: CalendarioService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        CalendarioService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(CalendarioService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('lista los eventos con filtros y paginación', () => {
    const paginacion = { limit: 50, offset: 0, total: 1 };
    const filtros = {
      desde: '2026-11-01T00:00:00.000Z',
      hasta: '2026-11-30T23:59:59.999Z',
      tipo_evento: 'examen' as const,
    };

    service.listarEventos(filtros).subscribe((resultado) => {
      expect(resultado.eventos).toHaveLength(1);
      expect(resultado.eventos[0].titulo).toBe(mockEvento.titulo);
      expect(resultado.paginacion).toEqual(paginacion);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/calendario');
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('desde')).toBe(filtros.desde);
    expect(req.request.params.get('hasta')).toBe(filtros.hasta);
    expect(req.request.params.get('tipo_evento')).toBe('examen');
    req.flush({ success: true, data: [mockEvento], meta: { paginacion } });
  });

  it('lista los próximos eventos con su rango', () => {
    const rango = {
      dias: 7,
      desde: '2026-11-10T00:00:00.000Z',
      hasta: '2026-11-17T00:00:00.000Z',
    };

    service.listarProximos(7, 5).subscribe((resultado) => {
      expect(resultado.eventos).toHaveLength(1);
      expect(resultado.rango).toEqual(rango);
    });

    const req = httpMock.expectOne((request) => request.url === '/api/calendario/proximos');
    expect(req.request.params.get('dias')).toBe('7');
    expect(req.request.params.get('limit')).toBe('5');
    req.flush({ success: true, data: [mockEvento], meta: { total: 1, rango } });
  });

  it('obtiene el detalle de un evento', () => {
    service.obtenerEvento(mockEvento.id).subscribe((evento) => {
      expect(evento.id).toBe(mockEvento.id);
    });

    const req = httpMock.expectOne(`/api/calendario/${mockEvento.id}`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, data: mockEvento });
  });

  it('crea un evento con los datos enviados', () => {
    const input = {
      titulo: mockEvento.titulo,
      tipo_evento: mockEvento.tipo_evento,
      fecha_inicio: mockEvento.fecha_inicio,
      fecha_fin: mockEvento.fecha_fin,
      recordatorio: mockEvento.recordatorio,
    };

    service.crearEvento(input).subscribe((evento) => {
      expect(evento.id).toBe(mockEvento.id);
    });

    const req = httpMock.expectOne('/api/calendario');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(input);
    req.flush({ success: true, data: mockEvento });
  });

  it('actualiza un evento existente', () => {
    service.actualizarEvento(mockEvento.id, { titulo: 'Nuevo título' }).subscribe((evento) => {
      expect(evento.titulo).toBe(mockEvento.titulo);
    });

    const req = httpMock.expectOne(`/api/calendario/${mockEvento.id}`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ titulo: 'Nuevo título' });
    req.flush({ success: true, data: mockEvento });
  });

  it('elimina un evento', () => {
    service.eliminarEvento(mockEvento.id).subscribe();

    const req = httpMock.expectOne(`/api/calendario/${mockEvento.id}`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { id: mockEvento.id } });
  });

  it('convierte fechas del input al formato ISO y de vuelta', () => {
    expect(service.aFechaIso('2026-11-20T14:00')).toBe('2026-11-20T14:00:00.000Z');
    expect(service.aFechaIso('')).toBe('');
    expect(service.aFechaInput('2026-11-20T14:00:00.000Z')).toBe('2026-11-20T14:00');
    expect(service.aFechaInput(null)).toBe('');
  });

  it('obtiene la materia asociada al evento', () => {
    expect(service.obtenerMateriaDeEvento(mockEvento)?.nombre).toBe('Cálculo');
    expect(
      service.obtenerMateriaDeEvento({ ...mockEvento, materias: [materiaResumen] })?.codigo,
    ).toBe('MAT101');
    expect(service.obtenerMateriaDeEvento({ ...mockEvento, materias: null })).toBeNull();
  });

  it('adapta los eventos a FullCalendar con el color de la materia', () => {
    const [evento] = service.aEventosFullCalendar([mockEvento]);

    expect(evento.id).toBe(mockEvento.id);
    expect(evento.title).toBe(mockEvento.titulo);
    expect(evento.start).toBe(mockEvento.fecha_inicio);
    expect(evento.end).toBe(mockEvento.fecha_fin);
    expect(evento.backgroundColor).toBe(materiaResumen.color);
    expect(evento.extendedProps?.['tipo_evento']).toBe('examen');
  });

  it('usa el color del tipo y omite el fin cuando el evento no tiene materia', () => {
    const sinMateria: EventoCalendario = {
      ...mockEvento,
      materias: null,
      fecha_fin: null,
      tipo_evento: 'examen',
    };

    const [evento] = service.aEventosFullCalendar([sinMateria]);

    expect(evento.backgroundColor).toBe(service.obtenerColorTipo('examen'));
    expect(evento.end).toBeUndefined();
  });

  it('devuelve la clase de badge y la etiqueta del tipo', () => {
    expect(service.obtenerTipoBadgeClase('entrega')).toContain('text-bg-primary');
    expect(service.obtenerTipoTexto('estudio')).toBe('Estudio');
  });
});
