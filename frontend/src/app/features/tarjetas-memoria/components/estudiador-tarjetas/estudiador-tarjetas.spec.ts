import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import {
  TarjetaService,
  type ConjuntoTarjetasDetalle,
  type Tarjeta,
} from '../../../../core/services/tarjeta.service';
import { EstudiadorTarjetasComponent } from './estudiador-tarjetas';

const CONJUNTO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';
const PRIMERA_ID = '11111111-1111-4111-8111-111111111111';
const SEGUNDA_ID = '22222222-2222-4222-8222-222222222222';

function crearTarjeta(id: string, orden: number, frente: string): Tarjeta {
  return {
    id,
    conjunto_id: CONJUNTO_ID,
    orden,
    frente,
    reverso: `Respuesta de ${frente}`,
    estado: 'sin_revisar',
    fecha_actualizacion: '2026-11-19T10:00:00.000Z',
  };
}

const tarjetas: Tarjeta[] = [
  crearTarjeta(PRIMERA_ID, 1, '¿Qué mide la derivada?'),
  crearTarjeta(SEGUNDA_ID, 2, '¿Qué es la continuidad?'),
];

const detalle: ConjuntoTarjetasDetalle = {
  id: CONJUNTO_ID,
  usuario_id: 'usuario-1',
  materia_id: '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d',
  materia_nombre: 'Cálculo Diferencial',
  documento_id: null,
  titulo: 'Tarjetas de cálculo',
  cantidad_tarjetas: 2,
  cantidad_conocidas: 0,
  cantidad_pendientes: 2,
  modelo: 'gemini-3.5-flash-lite',
  tokens_entrada: 500,
  tokens_salida: 300,
  fecha_creacion: '2026-11-19T10:00:00.000Z',
  tarjetas,
};

describe('EstudiadorTarjetasComponent (HU14)', () => {
  let fixture: ComponentFixture<EstudiadorTarjetasComponent>;
  let componente: EstudiadorTarjetasComponent;
  const obtener = vi.fn();
  const actualizarEstado = vi.fn();

  beforeEach(() => {
    obtener.mockReset().mockReturnValue(of(detalle));
    actualizarEstado.mockReset().mockImplementation((_id: string, estado: string) =>
      of({ ...tarjetas[0], estado }),
    );

    TestBed.configureTestingModule({
      imports: [EstudiadorTarjetasComponent],
      providers: [
        {
          provide: TarjetaService,
          useValue: { obtener, actualizarEstado },
        },
      ],
    });

    fixture = TestBed.createComponent(EstudiadorTarjetasComponent);
    componente = fixture.componentInstance;
    fixture.componentRef.setInput('conjuntoId', CONJUNTO_ID);
    fixture.componentRef.setInput('titulo', 'Tarjetas de cálculo');
    fixture.detectChanges();
  });

  afterEach(() => {
    TestBed.resetTestingModule();
  });

  it('carga el conjunto y muestra el frente sin revelar el reverso', () => {
    expect(obtener).toHaveBeenCalledWith(CONJUNTO_ID, 'todas');
    expect(componente.tarjetas()).toHaveLength(2);

    const texto = fixture.nativeElement.textContent;
    expect(texto).toContain('¿Qué mide la derivada?');
    expect(texto).not.toContain('Respuesta de ¿Qué mide la derivada?');
  });

  it('revela la respuesta solo cuando se solicita', () => {
    componente.revelar();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Respuesta de ¿Qué mide la derivada?');
  });

  it('avanza y retrocede entre tarjetas ocultando la respuesta', () => {
    componente.revelar();
    componente.siguiente();
    fixture.detectChanges();

    expect(componente.indice()).toBe(1);
    expect(componente.revelada()).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('¿Qué es la continuidad?');

    componente.anterior();
    expect(componente.indice()).toBe(0);
  });

  it('marca una tarjeta como conocida, avanza y notifica el cambio', () => {
    const notificaciones: number[] = [];
    componente.actualizado.subscribe(() => notificaciones.push(1));
    componente.revelar();

    componente.marcar('conocida');
    fixture.detectChanges();

    expect(actualizarEstado).toHaveBeenCalledWith(PRIMERA_ID, 'conocida');
    expect(componente.conocidas()).toBe(1);
    expect(componente.indice()).toBe(1);
    expect(notificaciones).toHaveLength(1);
  });

  it('recarga solo las tarjetas pendientes cuando se repite el repaso', () => {
    obtener.mockReturnValue(of({ ...detalle, tarjetas: [tarjetas[1]] }));

    componente.repetirPendientes();

    expect(obtener).toHaveBeenLastCalledWith(CONJUNTO_ID, 'pendientes');
    expect(componente.tarjetas()).toHaveLength(1);
    expect(componente.filtro()).toBe('pendientes');
  });

  it('muestra un mensaje seguro cuando falla la carga', () => {
    obtener.mockReturnValue(throwError(() => new Error('Sin conexión')));

    componente.cargar('todas');
    fixture.detectChanges();

    expect(componente.error()).toBe('Sin conexión');
    expect(fixture.nativeElement.textContent).toContain('Sin conexión');
  });

  it('ofrece volver a estudiar todas cuando no quedan pendientes', () => {
    obtener.mockReturnValue(of({ ...detalle, tarjetas: [] }));

    componente.repetirPendientes();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No quedan tarjetas pendientes');
  });
});
