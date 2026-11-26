import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  CuestionarioService,
  type CalificacionCuestionario,
} from '../../../../core/services/cuestionario.service';
import { CuestionarioCalificacionesComponent } from './cuestionario-calificaciones';

const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const calificacion: CalificacionCuestionario = {
  estudiante_id: 'estudiante-1',
  estudiante_nombre: 'Ana Torres',
  puntuacion: 92,
  estado: 'finalizado',
  fecha_inicio: '2026-11-19T10:05:00.000Z',
  fecha_finalizacion: '2026-11-19T10:10:00.000Z',
  respuestas_correctas: 9,
  total_preguntas: 10,
};

describe('CuestionarioCalificacionesComponent (HU18)', () => {
  let fixture: ComponentFixture<CuestionarioCalificacionesComponent>;
  let componente: CuestionarioCalificacionesComponent;
  const listarCalificaciones = vi.fn();

  const crearComponente = (): void => {
    fixture = TestBed.createComponent(CuestionarioCalificacionesComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('cuestionarioId', CUESTIONARIO_ID);
    fixture.componentRef.setInput('titulo', 'Repaso de cálculo');
    fixture.detectChanges();
  };

  beforeEach(() => {
    listarCalificaciones
      .mockReset()
      .mockReturnValue(of({ calificaciones: [calificacion], total: 1 }));

    TestBed.configureTestingModule({
      imports: [CuestionarioCalificacionesComponent],
      providers: [{ provide: CuestionarioService, useValue: { listarCalificaciones } }],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga las calificaciones y muestra una tabla accesible', () => {
    crearComponente();

    expect(listarCalificaciones).toHaveBeenCalledWith(CUESTIONARIO_ID, {
      limit: 50,
      offset: 0,
    });
    expect(componente.isLoading()).toBe(false);
    expect(componente.total()).toBe(1);

    const tabla = fixture.nativeElement.querySelector('table');
    expect(tabla).not.toBeNull();
    expect(tabla.querySelectorAll('thead th[scope="col"]')).toHaveLength(6);
    expect(fixture.nativeElement.textContent).toContain('Ana Torres');
    expect(fixture.nativeElement.textContent).toContain('92%');
    expect(fixture.nativeElement.textContent).toContain('9/10');
  });

  it('muestra el estado vacío cuando no hay intentos', () => {
    listarCalificaciones.mockReturnValue(of({ calificaciones: [], total: 0 }));
    crearComponente();

    expect(componente.estaVacio()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Todavía no hay calificaciones');
    expect(fixture.nativeElement.querySelector('table')).toBeNull();
  });

  it('muestra un error seguro y permite reintentar', () => {
    listarCalificaciones.mockReturnValue(throwError(() => new Error('Sin conexión')));
    crearComponente();

    expect(componente.errorMessage()).toBe('Sin conexión');
    expect(componente.isLoading()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
    expect(fixture.nativeElement.querySelector('button.btn-outline-danger')).not.toBeNull();
  });

  it('emite cierre al pulsar el botón', () => {
    crearComponente();
    const cerrado = vi.fn();
    componente.cerrar.subscribe(cerrado);

    fixture.nativeElement.querySelector('button.btn-outline-info').click();

    expect(cerrado).toHaveBeenCalledTimes(1);
  });
});
