import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import {
  CuestionarioService,
  type CuestionarioResumen,
} from '../../core/services/cuestionario.service';
import { DocumentoService } from '../../core/services/documento.service';
import { MateriaService } from '../../core/services/materia.service';
import { CentroEstudioPage } from './centro-estudio';

const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const DISPONIBLE_ID = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';

function crearCuestionario(id: string, titulo: string, publicado = false): CuestionarioResumen {
  return {
    id,
    usuario_id: 'usuario-1',
    materia_id: null,
    materia_nombre: 'Cálculo Diferencial',
    documento_id: null,
    titulo,
    dificultad: 'intermedia',
    cantidad_preguntas: 5,
    tipos: ['opcion_multiple'],
    modelo: 'gemini-3.5-flash-lite',
    tokens_entrada: 500,
    tokens_salida: 800,
    fecha_creacion: '2026-11-19T10:00:00.000Z',
    publicado,
    fecha_publicacion: publicado ? '2026-11-20T10:00:00.000Z' : null,
    fecha_inicio: publicado ? '2026-11-27T08:00:00.000Z' : null,
    fecha_limite: publicado ? '2026-11-30T23:59:00.000Z' : null,
  };
}

const cuestionario = crearCuestionario(CUESTIONARIO_ID, 'Repaso de cálculo');
const disponible = crearCuestionario(DISPONIBLE_ID, 'Cuestionario publicado', true);

describe('CentroEstudioPage (HU13/HU18)', () => {
  let fixture: ComponentFixture<CentroEstudioPage>;
  let componente: CentroEstudioPage;
  const rolDocente = signal(false);
  const listar = vi.fn();
  const listarDisponibles = vi.fn();
  const publicar = vi.fn();
  const listarIntentos = vi.fn();
  const listarCalificaciones = vi.fn();
  const listarMaterias = vi.fn();
  const listarDocumentos = vi.fn();

  const crearPagina = (docente: boolean): void => {
    rolDocente.set(docente);
    fixture = TestBed.createComponent(CentroEstudioPage);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  };

  beforeEach(() => {
    listar.mockReset().mockReturnValue(of({ cuestionarios: [cuestionario], total: 1 }));
    listarDisponibles.mockReset().mockReturnValue(of({ cuestionarios: [disponible], total: 1 }));
    publicar
      .mockReset()
      .mockReturnValue(of(crearCuestionario(CUESTIONARIO_ID, 'Repaso de cálculo', true)));
    listarIntentos.mockReset().mockReturnValue(of({ intentos: [], total: 0 }));
    listarCalificaciones.mockReset().mockReturnValue(of({ calificaciones: [], total: 0 }));
    listarMaterias.mockReset().mockReturnValue(of({ success: true, data: [], meta: {} }));
    listarDocumentos.mockReset().mockReturnValue(of({ documentos: [], paginacion: {} }));

    TestBed.configureTestingModule({
      imports: [CentroEstudioPage],
      providers: [
        provideRouter([]),
        {
          provide: CuestionarioService,
          useValue: {
            listar,
            listarDisponibles,
            publicar,
            listarIntentos,
            listarCalificaciones,
            etiquetaDificultad: (valor: string) => valor,
            etiquetaTipo: (valor: string) => valor,
          },
        },
        { provide: MateriaService, useValue: { listarMaterias } },
        { provide: DocumentoService, useValue: { listar: listarDocumentos } },
        { provide: AuthService, useValue: { isDocente: rolDocente.asReadonly() } },
      ],
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga los cuestionarios disponibles al iniciar y ofrece resolverlos', () => {
    crearPagina(false);

    expect(listarDisponibles).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(componente.cuestionariosDisponibles()).toEqual([disponible]);
    expect(fixture.nativeElement.textContent).toContain('Cuestionarios disponibles');
    expect(fixture.nativeElement.textContent).toContain('Cuestionario publicado');
    expect(fixture.nativeElement.textContent).toContain('Resolver');
  });

  it('muestra el estado vacío de los cuestionarios disponibles', () => {
    listarDisponibles.mockReturnValue(of({ cuestionarios: [], total: 0 }));
    crearPagina(false);

    expect(componente.mostrarListaVaciaDisponibles()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('No hay cuestionarios disponibles');
  });

  it('muestra un error seguro al fallar la carga de disponibles', () => {
    listarDisponibles.mockReturnValue(
      throwError(() => new Error('No se pudieron cargar los cuestionarios disponibles.')),
    );
    crearPagina(false);

    expect(componente.errorDisponibles()).toBe(
      'No se pudieron cargar los cuestionarios disponibles.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'No se pudieron cargar los cuestionarios disponibles.',
    );
    expect(fixture.nativeElement.textContent).toContain('Reintentar');
  });

  it('muestra las acciones de docente solo para docentes', () => {
    crearPagina(true);

    expect(componente.esDocente()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Publicar');
    expect(fixture.nativeElement.textContent).toContain('Ver notas');
    expect(fixture.nativeElement.textContent).toContain('Borrador');

    fixture.destroy();

    crearPagina(false);

    expect(componente.esDocente()).toBe(false);
    expect(fixture.nativeElement.textContent).not.toContain('Ver notas');
    expect(fixture.nativeElement.querySelector('[aria-label="Publicar cuestionario"]')).toBeNull();
  });

  it('publica un cuestionario con fecha de inicio y límite', () => {
    crearPagina(true);
    componente.ventanasPublicacion.set({
      [CUESTIONARIO_ID]: {
        inicio: '2026-11-27T08:00',
        limite: '2026-11-30T23:59',
      },
    });

    componente.publicar(cuestionario, true);
    fixture.detectChanges();

    expect(publicar).toHaveBeenCalledWith(
      CUESTIONARIO_ID,
      true,
      expect.objectContaining({
        fecha_inicio: expect.any(String),
        fecha_limite: expect.any(String),
      }),
    );
    expect(componente.cuestionarios()[0].publicado).toBe(true);
    expect(componente.mensajeExito()).toContain('está disponible');
    expect(listarDisponibles).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Publicado');
  });

  it('evita publicar dos veces mientras hay una solicitud en curso', () => {
    const respuesta = new Subject<CuestionarioResumen>();
    publicar.mockReturnValue(respuesta.asObservable());
    crearPagina(true);
    componente.ventanasPublicacion.set({
      [CUESTIONARIO_ID]: {
        inicio: '2026-11-27T08:00',
        limite: '2026-11-30T23:59',
      },
    });

    componente.publicar(cuestionario, true);
    componente.publicar(cuestionario, true);

    expect(publicar).toHaveBeenCalledTimes(1);
    expect(componente.publicandoId()).toBe(CUESTIONARIO_ID);
  });

  it('no publica sin fecha de inicio y límite', () => {
    crearPagina(true);

    componente.publicar(cuestionario, true);

    expect(publicar).not.toHaveBeenCalled();
    expect(componente.errorAccion()).toContain('fecha de inicio');
  });

  it('abre y cierra el panel de calificaciones', () => {
    crearPagina(true);
    const botonNotas = Array.from(
      fixture.nativeElement.querySelectorAll('button') as NodeListOf<HTMLButtonElement>,
    ).find((boton) => boton.textContent?.includes('Ver notas'));

    botonNotas?.click();
    fixture.detectChanges();

    expect(componente.calificacionesDe()).toEqual({
      id: CUESTIONARIO_ID,
      titulo: cuestionario.titulo,
    });
    const panel = fixture.nativeElement.querySelector('app-cuestionario-calificaciones');
    expect(panel).not.toBeNull();

    panel.querySelector('button.btn-outline-info').click();
    fixture.detectChanges();

    expect(componente.calificacionesDe()).toBeNull();
  });

  it('recarga los disponibles al completar un intento', () => {
    crearPagina(false);

    componente.alCompletar();

    expect(listarDisponibles).toHaveBeenCalledTimes(2);
  });
});
