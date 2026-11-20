import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import {
  BusquedaService,
  type FragmentoBusqueda,
} from '../../../../core/services/busqueda.service';
import type { Materia } from '../../../../core/services/materia.service';
import { BusquedaSemanticaComponent } from './busqueda-semantica';

const DOCUMENTO_ID = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

const materia: Materia = {
  id: '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
  usuario_id: 'usuario-1',
  nombre: 'Cálculo diferencial',
  codigo: 'MAT-101',
  docente: 'Ana Pérez',
  descripcion: null,
  periodo_academico: '2026-1',
  color: '#3B82F6',
  estado: 'activo',
  fecha_creacion: '2026-11-01T00:00:00.000Z',
  fecha_actualizacion: null,
  total_tareas: 0,
  tareas_pendientes: 0,
  total_documentos: 1,
};

const fragmento: FragmentoBusqueda = {
  fragmento_id: 'fragmento-1',
  documento_id: DOCUMENTO_ID,
  documento_nombre: 'Apuntes de cálculo',
  contenido: 'La derivada mide la tasa de cambio instantánea.',
  numero_pagina: 12,
  similitud: 0.873421,
};

const buscar = vi.fn();

describe('BusquedaSemanticaComponent (HU11)', () => {
  let fixture: ComponentFixture<BusquedaSemanticaComponent>;
  let componente: BusquedaSemanticaComponent;

  beforeEach(() => {
    buscar.mockReset();

    TestBed.configureTestingModule({
      imports: [BusquedaSemanticaComponent],
      providers: [provideRouter([]), { provide: BusquedaService, useValue: { buscar } }],
    });

    fixture = TestBed.createComponent(BusquedaSemanticaComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('materias', [materia]);
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('no consulta si la búsqueda tiene menos de dos caracteres', () => {
    componente.consulta.set('a');
    componente.buscar();

    expect(buscar).not.toHaveBeenCalled();
  });

  it('usa un icono de búsqueda en lugar de la mascota', () => {
    expect(fixture.nativeElement.querySelector('.busqueda-icono .bi-binoculars')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('app-mascota-agente')).toBeNull();
  });

  it('muestra los fragmentos con origen, página, similitud y enlace al documento', () => {
    buscar.mockReturnValue(
      of({ resultados: [fragmento], mensaje: null }),
    );

    componente.consulta.set('derivadas');
    componente.materiaId.set(materia.id);
    componente.buscar();
    fixture.detectChanges();

    expect(buscar).toHaveBeenCalledWith('derivadas', {
      materiaId: materia.id,
      limit: 8,
    });

    const texto = fixture.nativeElement.textContent as string;
    expect(texto).toContain('Apuntes de cálculo');
    expect(texto).toContain('Página 12');
    expect(texto).toContain('Similitud 87%');
    expect(texto).toContain('La derivada mide la tasa de cambio instantánea.');

    const enlace = fixture.nativeElement.querySelector('a') as HTMLAnchorElement;
    expect(enlace.getAttribute('href')).toBe(`/biblioteca/${DOCUMENTO_ID}`);
  });

  it('muestra el mensaje del backend cuando no hay resultados', () => {
    buscar.mockReturnValue(
      of({ resultados: [], mensaje: 'Prueba con otros términos.' }),
    );

    componente.consulta.set('temas sin coincidencia');
    componente.buscar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Prueba con otros términos.');
  });

  it('muestra un error claro y permite reintentar', () => {
    buscar.mockReturnValue(throwError(() => ({})));

    componente.consulta.set('derivadas');
    componente.buscar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo realizar la búsqueda inteligente.',
    );

    buscar.mockReturnValue(of({ resultados: [fragmento], mensaje: null }));
    componente.buscar();
    fixture.detectChanges();

    expect(buscar).toHaveBeenCalledTimes(2);
    expect(componente.resultados()).toEqual([fragmento]);
  });

  it('limpia el estado de la búsqueda', () => {
    buscar.mockReturnValue(of({ resultados: [fragmento], mensaje: null }));

    componente.consulta.set('derivadas');
    componente.buscar();
    componente.limpiar();
    fixture.detectChanges();

    expect(componente.consulta()).toBe('');
    expect(componente.resultados()).toEqual([]);
    expect(componente.busquedaRealizada()).toBe(false);
  });
});
