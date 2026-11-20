import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AyudanteFlotanteComponent } from './ayudante-flotante.component';

describe('AyudanteFlotanteComponent', () => {
  let fixture: ComponentFixture<AyudanteFlotanteComponent> | undefined;
  let componente: AyudanteFlotanteComponent | undefined;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [AyudanteFlotanteComponent],
      providers: [provideRouter([])],
    });
  });

  afterEach(() => {
    fixture?.destroy();
    fixture = undefined;
    componente = undefined;
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  function crearComponente(): void {
    fixture = TestBed.createComponent(AyudanteFlotanteComponent);
    componente = fixture.componentInstance;
    fixture.detectChanges();
  }

  function boton(): HTMLButtonElement {
    return fixture!.nativeElement.querySelector('.ayudante') as HTMLButtonElement;
  }

  it('muestra el mensaje base, mantiene la mascota quieta y abre el asistente', () => {
    crearComponente();
    const navegar = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

    expect(boton().querySelector('.ayudante__globo')?.textContent).toContain(
      '¿En qué puedo ayudarte?',
    );
    expect(boton().getAttribute('aria-label')).toContain('Abrir asistente IA');
    expect(boton().querySelector('svg')?.getAttribute('viewBox')).toBe('30 16 240 240');
    expect(
      (boton().querySelector('.mascota__seguimiento') as HTMLElement).style.transform,
    ).toBe('');

    boton().click();

    expect(navegar).toHaveBeenCalledWith(['/asistente-ia']);
  });

  it('se duerme por inactividad y luego sorprende con un mensaje', () => {
    vi.useFakeTimers();
    crearComponente();

    vi.advanceTimersByTime(12000);
    fixture!.detectChanges();

    expect(componente!.estado()).toBe('durmiendo');
    expect(componente!.mensaje()).toBe('Zzz…');
    expect(fixture!.nativeElement.querySelector('.mascota--durmiendo')).not.toBeNull();

    vi.advanceTimersByTime(6000);
    fixture!.detectChanges();

    expect(componente!.estado()).toBe('hablando');
    expect(componente!.mensaje()).toContain('¡Sorpresa!');

    vi.advanceTimersByTime(2600);
    fixture!.detectChanges();

    expect(componente!.estado()).toBe('inactivo');
    expect(componente!.mensaje()).toBe('¿En qué puedo ayudarte?');
  });

  it('despierta al interactuar y vuelve al reposo', () => {
    vi.useFakeTimers();
    crearComponente();

    vi.advanceTimersByTime(12000);
    fixture!.detectChanges();
    boton().dispatchEvent(new MouseEvent('mouseenter'));
    fixture!.detectChanges();

    expect(componente!.estado()).toBe('hablando');
    expect(componente!.mensaje()).toContain('¡Hola!');
    expect(boton().classList.contains('ayudante--hablando')).toBe(true);

    vi.advanceTimersByTime(1800);
    fixture!.detectChanges();

    expect(componente!.estado()).toBe('inactivo');
    expect(componente!.mensaje()).toBe('¿En qué puedo ayudarte?');
  });
});
