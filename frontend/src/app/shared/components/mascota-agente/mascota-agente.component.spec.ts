import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MascotaAgenteComponent } from './mascota-agente.component';

describe('MascotaAgenteComponent', () => {
  let fixture: ComponentFixture<MascotaAgenteComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MascotaAgenteComponent] });
    fixture = TestBed.createComponent(MascotaAgenteComponent);
    fixture.detectChanges();
  });

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

  it('usa prefijos distintos para los degradados de cada instancia', () => {
    const otra = TestBed.createComponent(MascotaAgenteComponent);

    expect(otra.componentInstance.prefijo).not.toBe(fixture.componentInstance.prefijo);
    otra.destroy();
  });
});
