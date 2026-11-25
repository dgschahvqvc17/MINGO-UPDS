import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import { ProgresoService } from '../../core/services/progreso.service';
import type { Objetivo, Progreso } from '../../core/models/progreso.model';
import { ProgresoPage } from './progreso';

const OBJETIVO_ID = 'b7e3a2c1-9d4f-4e6a-8b2c-3d1f5a7e9c02';

const materia: Materia = {
  id: '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
  usuario_id: 'usuario-1',
  nombre: 'Cálculo Diferencial',
  codigo: 'MAT-101',
  docente_id: null,
  docente: 'Ana Pérez',
  descripcion: null,
  periodo_academico: '2026-1',
  color: '#0d6efd',
  estado: 'activo',
  fecha_creacion: '2026-01-01T00:00:00.000Z',
  fecha_actualizacion: null,
  total_tareas: 0,
  tareas_pendientes: 0,
  total_documentos: 0,
};

const objetivo: Objetivo = {
  id: OBJETIVO_ID,
  usuario_id: 'usuario-1',
  materia_id: materia.id,
  titulo: 'Aprobar el parcial de cálculo',
  descripcion: 'Repasar derivadas',
  fecha_limite: '2026-12-10',
  estado: 'pendiente',
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  fecha_actualizacion: null,
  materias: { nombre: materia.nombre, codigo: materia.codigo, color: materia.color },
};

const progreso: Progreso = {
  materias_activas: 1,
  tareas_pendientes: 1,
  tareas_completadas: 3,
  cumplimiento_tareas: 0.75,
  sesiones_totales: 4,
  sesiones_completadas: 2,
  cumplimiento_sesiones: 0.5,
  minutos_estudiados: 130,
  cuestionarios_completados: 2,
  promedio_cuestionarios: 80,
  objetivos_activos: 1,
  objetivos_completados: 1,
  cumplimiento_objetivos: 0.5,
  racha_dias: 4,
  por_estado: {
    tareas: [],
    objetivos: [],
    sesiones: [],
  },
  actividad_semanal: [
    { fecha: '2026-11-13', etiqueta: 'vie', tareas: 1, sesiones: 0 },
    { fecha: '2026-11-14', etiqueta: 'sáb', tareas: 0, sesiones: 1 },
    { fecha: '2026-11-15', etiqueta: 'dom', tareas: 0, sesiones: 0 },
    { fecha: '2026-11-16', etiqueta: 'lun', tareas: 2, sesiones: 1 },
    { fecha: '2026-11-17', etiqueta: 'mar', tareas: 0, sesiones: 0 },
    { fecha: '2026-11-18', etiqueta: 'mié', tareas: 1, sesiones: 1 },
    { fecha: '2026-11-19', etiqueta: 'jue', tareas: 0, sesiones: 0 },
  ],
  actividades_atencion: [
    {
      tipo: 'tarea',
      id: 'tarea-1',
      titulo: 'Ensayo final',
      materia: 'Lenguaje',
      motivo: 'Vencida',
      fecha: '2026-11-15T00:00:00.000Z',
    },
  ],
  recomendaciones: [
    {
      tipo: 'tareas',
      prioridad: 'alta',
      mensaje: 'Prioriza las tareas vencidas.',
    },
  ],
  generado_en: '2026-11-19T10:00:00.000Z',
};

describe('ProgresoPage (HU17)', () => {
  let fixture: ComponentFixture<ProgresoPage>;
  let componente: ProgresoPage;
  const listarObjetivos = vi.fn();
  const crearObjetivo = vi.fn();
  const actualizarObjetivo = vi.fn();
  const eliminarObjetivo = vi.fn();
  const obtenerProgreso = vi.fn();
  const listarMaterias = vi.fn();

  beforeEach(() => {
    listarObjetivos.mockReset().mockReturnValue(of({ objetivos: [objetivo], total: 1 }));
    crearObjetivo.mockReset().mockReturnValue(of(objetivo));
    actualizarObjetivo.mockReset().mockReturnValue(of(objetivo));
    eliminarObjetivo.mockReset().mockReturnValue(of(undefined));
    obtenerProgreso.mockReset().mockReturnValue(of(progreso));
    listarMaterias.mockReset().mockReturnValue(of({ success: true, data: [materia], meta: {} }));

    TestBed.configureTestingModule({
      imports: [ProgresoPage],
      providers: [
        provideRouter([]),
        {
          provide: ProgresoService,
          useValue: {
            listarObjetivos,
            crearObjetivo,
            actualizarObjetivo,
            eliminarObjetivo,
            obtenerProgreso,
          },
        },
        { provide: MateriaService, useValue: { listarMaterias } },
      ],
    });

    fixture = TestBed.createComponent(ProgresoPage);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga materias, objetivos y progreso al iniciar', () => {
    expect(listarMaterias).toHaveBeenCalledWith({ estado: 'activo', limit: 100 });
    expect(listarObjetivos).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(obtenerProgreso).toHaveBeenCalledTimes(1);
    expect(componente.materiasActivas()).toEqual([materia]);
    expect(fixture.nativeElement.textContent).toContain('Aprobar el parcial de cálculo');
    expect(fixture.nativeElement.textContent).toContain('Actividades que necesitan atención');
  });

  it('calcula el cumplimiento general y el tamaño de las barras', () => {
    expect(componente.cumplimientoGeneral()).toBe(58);
    expect(componente.alturaBarra(3)).toBe(100);
    expect(componente.alturaBarra(0)).toBe(0);
    expect(componente.horasEstudiadas()).toBe(2);
    expect(componente.minutosEstudiados()).toBe(10);
  });

  it('muestra estados vacíos cuando no hay objetivos ni progreso', () => {
    listarObjetivos.mockReturnValue(of({ objetivos: [], total: 0 }));
    obtenerProgreso.mockReturnValue(
      of({
        ...progreso,
        actividades_atencion: [],
        recomendaciones: [],
        actividad_semanal: progreso.actividad_semanal.map((dia) => ({
          ...dia,
          tareas: 0,
          sesiones: 0,
        })),
      }),
    );

    componente.cargarObjetivos();
    componente.cargarProgreso();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay objetivos en esta vista');
    expect(fixture.nativeElement.textContent).toContain('Aún no hay actividad registrada');
  });

  it('muestra un error cuando falla la carga del progreso', () => {
    obtenerProgreso.mockReturnValue(throwError(() => new Error('Fallo de red')));

    componente.cargarProgreso();
    fixture.detectChanges();

    expect(componente.error()).toContain('Fallo de red');
    expect(fixture.nativeElement.textContent).toContain('Fallo de red');
  });

  it('filtra los objetivos por estado', () => {
    componente.cambiarFiltro('completada');
    fixture.detectChanges();

    expect(listarObjetivos).toHaveBeenCalledWith({
      estado: 'completada',
      limit: 20,
      offset: 0,
    });
  });

  it('acepta solo estados válidos al cambiar el estado del formulario', () => {
    componente.alCambiarEstado('en_progreso');
    expect(componente.estado()).toBe('en_progreso');

    componente.alCambiarEstado('estado-invalido');
    expect(componente.estado()).toBe('en_progreso');
  });

  it('registra un objetivo con los datos del formulario', () => {
    componente.titulo.set('Terminar el curso de álgebra');
    componente.descripcion.set('Avanzar dos capítulos');
    componente.materiaId.set(materia.id);
    componente.fechaLimite.set('2026-12-20');

    componente.guardar();
    fixture.detectChanges();

    expect(crearObjetivo).toHaveBeenCalledWith({
      titulo: 'Terminar el curso de álgebra',
      descripcion: 'Avanzar dos capítulos',
      materia_id: materia.id,
      fecha_limite: '2026-12-20',
    });
    expect(componente.mensajeExito()).toContain('registrado');
  });

  it('actualiza el estado de un objetivo', () => {
    componente.cambiarEstado(objetivo, 'completada');

    expect(actualizarObjetivo).toHaveBeenCalledWith(OBJETIVO_ID, { estado: 'completada' });
  });

  it('elimina un objetivo', () => {
    componente.eliminar(objetivo);

    expect(eliminarObjetivo).toHaveBeenCalledWith(OBJETIVO_ID);
    expect(componente.mensajeExito()).toBe('Objetivo eliminado.');
  });
});
