import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { DocumentoService } from '../../core/services/documento.service';
import { MateriaService, type Materia } from '../../core/services/materia.service';
import {
  TarjetaService,
  type ConjuntoTarjetasGenerado,
  type ConjuntoTarjetasResumen,
} from '../../core/services/tarjeta.service';
import { TarjetasMemoriaPage } from './tarjetas-memoria';

const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const CONJUNTO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

const materia: Materia = {
  id: MATERIA_ID,
  usuario_id: 'usuario-1',
  nombre: 'Cálculo Diferencial',
  codigo: 'MAT-101',
  docente: 'Ana Pérez',
  descripcion: null,
  periodo_academico: '2026-1',
  color: '#0d6efd',
  estado: 'activo',
  fecha_creacion: '2026-01-01T00:00:00.000Z',
  fecha_actualizacion: null,
  total_tareas: 0,
  tareas_pendientes: 0,
  total_documentos: 1,
};

const conjunto: ConjuntoTarjetasResumen = {
  id: CONJUNTO_ID,
  usuario_id: 'usuario-1',
  materia_id: MATERIA_ID,
  materia_nombre: 'Cálculo Diferencial',
  documento_id: null,
  titulo: 'Tarjetas de cálculo',
  cantidad_tarjetas: 5,
  cantidad_conocidas: 0,
  cantidad_pendientes: 5,
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 300,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
};

const conjuntoGenerado: ConjuntoTarjetasGenerado = {
  ...conjunto,
  tarjetas: [
    {
      id: '11111111-1111-4111-8111-111111111111',
      conjunto_id: CONJUNTO_ID,
      orden: 1,
      frente: '¿Qué mide la derivada?',
      reverso: 'La tasa de cambio instantánea.',
      estado: 'sin_revisar',
      fecha_actualizacion: '2026-11-19T10:00:00.000Z',
    },
  ],
};

describe('TarjetasMemoriaPage (HU14)', () => {
  let fixture: ComponentFixture<TarjetasMemoriaPage>;
  let componente: TarjetasMemoriaPage;
  const listar = vi.fn();
  const generar = vi.fn();
  const obtener = vi.fn();
  const eliminar = vi.fn();
  const listarMaterias = vi.fn();
  const listarDocumentos = vi.fn();

  beforeEach(() => {
    listar.mockReset().mockReturnValue(of({ conjuntos: [conjunto], total: 1 }));
    generar.mockReset().mockReturnValue(of(conjuntoGenerado));
    obtener.mockReset().mockReturnValue(of(conjuntoGenerado));
    eliminar.mockReset().mockReturnValue(of({ id: CONJUNTO_ID }));
    listarMaterias
      .mockReset()
      .mockReturnValue(of({ success: true, data: [materia], meta: {} }));
    listarDocumentos.mockReset().mockReturnValue(of({ documentos: [], paginacion: {} }));

    TestBed.configureTestingModule({
      imports: [TarjetasMemoriaPage],
      providers: [
        {
          provide: TarjetaService,
          useValue: { listar, generar, obtener, eliminar },
        },
        { provide: MateriaService, useValue: { listarMaterias } },
        { provide: DocumentoService, useValue: { listar: listarDocumentos } },
      ],
    });

    fixture = TestBed.createComponent(TarjetasMemoriaPage);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga materias y conjuntos al iniciar', () => {
    expect(listarMaterias).toHaveBeenCalledWith({ limit: 100 });
    expect(listar).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(componente.materiasActivas()).toEqual([materia]);
    expect(componente.conjuntos()).toEqual([conjunto]);
    expect(fixture.nativeElement.textContent).toContain('Tarjetas de cálculo');
  });

  it('muestra el estado vacío cuando no hay conjuntos', () => {
    listar.mockReturnValue(of({ conjuntos: [], total: 0 }));

    componente.cargarConjuntos();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes tarjetas');
  });

  it('muestra un mensaje seguro cuando falla la carga', () => {
    listar.mockReturnValue(throwError(() => new Error('No se pudieron cargar tus conjuntos')));

    componente.cargarConjuntos();
    fixture.detectChanges();

    expect(componente.error()).toBe('No se pudieron cargar tus conjuntos');
    expect(fixture.nativeElement.textContent).toContain('No se pudieron cargar tus conjuntos');
  });

  it('genera un conjunto y abre el estudiador', () => {
    componente.cambiarMateria(MATERIA_ID);
    componente.generar();
    fixture.detectChanges();

    expect(generar).toHaveBeenCalledWith({
      materia_id: MATERIA_ID,
      documento_id: null,
      cantidad_tarjetas: 10,
    });
    expect(componente.conjuntos()[0]).toEqual(conjuntoGenerado);
    expect(componente.estudiando()).toEqual({ id: CONJUNTO_ID, titulo: conjunto.titulo });
  });

  it('no genera si no se seleccionó una materia', () => {
    componente.generar();

    expect(generar).not.toHaveBeenCalled();
  });

  it('muestra el error de generación sin abrir el estudiador', () => {
    componente.cambiarMateria(MATERIA_ID);
    generar.mockReturnValue(throwError(() => new Error('No hay material suficiente')));

    componente.generar();
    fixture.detectChanges();

    expect(componente.error()).toBe('No hay material suficiente');
    expect(componente.estudiando()).toBeNull();
  });

  it('pide confirmación antes de eliminar un conjunto', () => {
    componente.solicitarEliminar(conjunto);
    fixture.detectChanges();

    expect(eliminar).not.toHaveBeenCalled();
    expect(componente.confirmandoEliminar()).toBe(CONJUNTO_ID);

    componente.solicitarEliminar(conjunto);

    expect(eliminar).toHaveBeenCalledWith(CONJUNTO_ID);
    expect(componente.conjuntos()).toEqual([]);
    expect(componente.totalConjuntos()).toBe(0);
  });

  it('carga los documentos procesados al elegir una materia', () => {
    componente.cambiarMateria(MATERIA_ID);

    expect(listarDocumentos).toHaveBeenCalledWith({
      materia_id: MATERIA_ID,
      estado: 'procesado',
      limit: 50,
    });
  });
});
