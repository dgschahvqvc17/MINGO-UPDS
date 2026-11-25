import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Inscripcion, InscripcionService } from './inscripcion.service';

const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const ESTUDIANTE_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const INSCRIPCION: Inscripcion = {
  id: 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f',
  materia_id: MATERIA_ID,
  estudiante_id: ESTUDIANTE_ID,
  usuario_id: ESTUDIANTE_ID,
  estado: 'activa',
  fecha_inscripcion: '2026-11-01T00:00:00.000Z',
  fecha_actualizacion: null,
  estudiante: {
    id: ESTUDIANTE_ID,
    nombre: 'Ana',
    apellido: 'Perez',
    correo: 'ana@universidad.edu',
  },
};

describe('InscripcionService', () => {
  let service: InscripcionService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        InscripcionService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(InscripcionService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    TestBed.resetTestingModule();
  });

  it('lista las inscripciones con paginacion', () => {
    service.listar(MATERIA_ID, 25, 5).subscribe((respuesta) => {
      expect(respuesta.inscripciones).toEqual([INSCRIPCION]);
      expect(respuesta.total).toBe(1);
    });

    const req = httpMock.expectOne(
      (request) => request.url === `/api/materias/${MATERIA_ID}/inscripciones`,
    );
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('limit')).toBe('25');
    expect(req.request.params.get('offset')).toBe('5');
    req.flush({
      success: true,
      data: [INSCRIPCION],
      meta: { total: 1, limit: 25, offset: 5 },
    });
  });

  it('inscribe a un estudiante enviando su usuario_id', () => {
    service.inscribir(MATERIA_ID, ESTUDIANTE_ID).subscribe((respuesta) => {
      expect(respuesta.id).toBe(INSCRIPCION.id);
    });

    const req = httpMock.expectOne(`/api/materias/${MATERIA_ID}/inscripciones`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ usuario_id: ESTUDIANTE_ID });
    req.flush({ success: true, data: INSCRIPCION });
  });

  it('desinscribe a un estudiante por su identificador', () => {
    service.desinscribir(MATERIA_ID, ESTUDIANTE_ID).subscribe((respuesta) => {
      expect(respuesta.estado).toBe('inactiva');
    });

    const req = httpMock.expectOne(
      `/api/materias/${MATERIA_ID}/inscripciones/${ESTUDIANTE_ID}`,
    );
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true, data: { ...INSCRIPCION, estado: 'inactiva' } });
  });
});
