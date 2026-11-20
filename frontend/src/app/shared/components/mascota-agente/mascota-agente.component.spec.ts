import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotaAgenteComponent } from './mascota-agente.component';

describe('MascotaAgenteComponent', () => {
  let fixture: ComponentFixture<MascotaAgenteComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MascotaAgenteComponent] });
    fixture = TestBed.createComponent(MascotaAgenteComponent);
    fixture.detectChanges();
  });

  afterEach(() => vi.useRealTimers());

  it('muestra la mascota en reposo con una etiqueta accesible', () => {
    const mascota = fixture.nativeElement.querySelector('.mascota') as HTMLElement;

    expect(mascota.classList.contains('mascota--inactivo')).toBe(true);
    expect(mascota.getAttribute('role')).toBe('img');
    expect(mascota.getAttribute('aria-label')).toContain('en reposo');
  });

  it('cambia de estado cuando recibe pensando y hablando', () => {
    fixture.componentRef.setInput('estado', 'pensando');
    fixture.detectChanges();

    let mascota = fixture.nativeElement.querySelector('.mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--pensando')).toBe(true);
    expect(mascota.getAttribute('aria-label')).toContain('pensando');

    fixture.componentRef.setInput('estado', 'hablando');
    fixture.detectChanges();

    mascota = fixture.nativeElement.querySelector('.mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--hablando')).toBe(true);
    expect(mascota.getAttribute('aria-label')).toContain('hablando');
  });

  it('aplica el tamaño compacto cuando se solicita', () => {
    fixture.componentRef.setInput('compacta', true);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).classList.contains('mascota--compacta')).toBe(
      true,
    );
  });

  it('muestra dos ojos abiertos y mueve las pupilas con el cursor', () => {
    expect(fixture.nativeElement.querySelectorAll('.mascota__pupila')).toHaveLength(2);
    expect(fixture.nativeElement.querySelectorAll('.mascota__parpado')).toHaveLength(2);

    fixture.componentInstance.mirada.set('translate(3.0px, 2.0px)');
    fixture.detectChanges();

    const pupilas = fixture.nativeElement.querySelectorAll(
      '.mascota__pupila',
    ) as NodeListOf<SVGGElement>;
    expect(pupilas[0].style.transform).toBe('translate(3.0px, 2.0px)');
    expect(pupilas[1].style.transform).toBe('translate(3.0px, 2.0px)');
  });

  it('prepara un párpado distinto por ojo para el guiño', () => {
    expect(fixture.nativeElement.querySelectorAll('.mascota__parpado--izquierdo')).toHaveLength(1);
    expect(fixture.nativeElement.querySelectorAll('.mascota__parpado--derecho')).toHaveLength(1);
  });

  it('inclina la cabeza cuando se activa el seguimiento', () => {
    fixture.componentRef.setInput('seguimientoCabeza', true);
    fixture.componentInstance.cabeza.set('rotate(4.0deg) translateY(1.0px)');
    fixture.detectChanges();

    const cabeza = fixture.nativeElement.querySelector('.mascota__cabeza') as SVGGElement;
    expect(cabeza.style.transform).toBe('rotate(4.0deg) translateY(1.0px)');
  });

  it('piensa y habla durante el saludo cuando se solicita', () => {
    vi.useFakeTimers();
    const saludo = TestBed.createComponent(MascotaAgenteComponent);
    saludo.componentRef.setInput('saludar', true);
    saludo.componentRef.setInput('hablaAlSaludar', true);
    saludo.detectChanges();

    const mascota = saludo.nativeElement.querySelector('.mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--pensando')).toBe(true);

    vi.advanceTimersByTime(500);
    saludo.detectChanges();
    expect(mascota.classList.contains('mascota--hablando')).toBe(true);

    vi.advanceTimersByTime(2700);
    saludo.detectChanges();
    expect(mascota.classList.contains('mascota--inactivo')).toBe(true);

    saludo.destroy();
  });

  it('usa prefijos distintos para los degradados de cada instancia', () => {
    const otra = TestBed.createComponent(MascotaAgenteComponent);

    expect(otra.componentInstance.prefijo).not.toBe(fixture.componentInstance.prefijo);
    otra.destroy();
  });

  it('muestra el halo y las partículas en tamaño grande', () => {
    const grande = TestBed.createComponent(MascotaAgenteComponent);
    grande.componentRef.setInput('grande', true);
    grande.detectChanges();

    const host = grande.nativeElement as HTMLElement;
    expect(host.classList.contains('mascota--grande')).toBe(true);
    expect(host.querySelector('.mascota__halo')).not.toBeNull();
    expect(host.querySelectorAll('.mascota__particula')).toHaveLength(6);

    grande.destroy();
  });

  it('saluda con un mensaje y vuelve al reposo al terminar', () => {
    vi.useFakeTimers();
    const saludo = TestBed.createComponent(MascotaAgenteComponent);
    saludo.componentRef.setInput('grande', true);
    saludo.componentRef.setInput('saludar', true);
    saludo.componentRef.setInput('mensaje', '¡Hola!');
    saludo.detectChanges();

    let mascota = saludo.nativeElement.querySelector('.mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--saludando')).toBe(true);
    expect(mascota.getAttribute('aria-label')).toContain('saludando');
    expect(saludo.nativeElement.querySelector('.mascota__burbuja')?.textContent).toContain('¡Hola!');

    vi.advanceTimersByTime(3200);
    saludo.detectChanges();

    mascota = saludo.nativeElement.querySelector('.mascota') as HTMLElement;
    expect(mascota.classList.contains('mascota--saludando')).toBe(false);
    expect(saludo.nativeElement.querySelector('.mascota__burbuja')).toBeNull();

    saludo.destroy();
  });
});
