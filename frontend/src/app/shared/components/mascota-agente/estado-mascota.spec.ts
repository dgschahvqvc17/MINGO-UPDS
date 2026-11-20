import { DestroyRef, inject, signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { crearEstadoMascota } from './estado-mascota';

describe('crearEstadoMascota', () => {
  let cargando: WritableSignal<boolean>;

  beforeEach(() => {
    vi.useFakeTimers();
    cargando = signal(false);
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  const crearControl = () =>
    TestBed.runInInjectionContext(() => crearEstadoMascota(cargando, inject(DestroyRef)));

  it('permanece inactiva sin carga ni resultado', () => {
    expect(crearControl().estado()).toBe('inactivo');
  });

  it('pasa a pensando mientras la petición está en curso', () => {
    const control = crearControl();

    cargando.set(true);
    expect(control.estado()).toBe('pensando');

    cargando.set(false);
    expect(control.estado()).toBe('inactivo');
  });

  it('anuncia el resultado con una fase hablando temporal', () => {
    const control = crearControl();

    control.anunciarResultado();
    expect(control.estado()).toBe('hablando');

    vi.advanceTimersByTime(2399);
    expect(control.estado()).toBe('hablando');

    vi.advanceTimersByTime(1);
    expect(control.estado()).toBe('inactivo');
  });

  it('reiniciar cancela la fase hablando y permite empezar de nuevo', () => {
    const control = crearControl();

    control.anunciarResultado();
    control.reiniciar();
    expect(control.estado()).toBe('inactivo');

    vi.advanceTimersByTime(2400);
    expect(control.estado()).toBe('inactivo');

    control.anunciarResultado();
    expect(control.estado()).toBe('hablando');
  });

  it('la carga tiene prioridad sobre una fase hablando pendiente', () => {
    const control = crearControl();
    control.anunciarResultado();

    cargando.set(true);
    expect(control.estado()).toBe('pensando');

    cargando.set(false);
    expect(control.estado()).toBe('hablando');
  });
});
