import { TestBed } from '@angular/core/testing';
import { PreferenciasInterfazService } from './preferencias-interfaz.service';

const CLAVE_ASISTENTE_FLOTANTE = 'mingo.asistente-flotante.visible';

describe('PreferenciasInterfazService', () => {
  beforeEach(() => {
    window.localStorage.clear();
    TestBed.resetTestingModule();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('muestra el asistente flotante por defecto', () => {
    TestBed.configureTestingModule({});

    const preferencias = TestBed.inject(PreferenciasInterfazService);

    expect(preferencias.asistenteFlotanteVisible()).toBe(true);
  });

  it('guarda la preferencia al ocultar el asistente flotante', () => {
    TestBed.configureTestingModule({});

    const preferencias = TestBed.inject(PreferenciasInterfazService);
    preferencias.establecerAsistenteFlotante(false);

    expect(preferencias.asistenteFlotanteVisible()).toBe(false);
    expect(window.localStorage.getItem(CLAVE_ASISTENTE_FLOTANTE)).toBe('false');
  });

  it('recupera la preferencia guardada al iniciar el servicio', () => {
    window.localStorage.setItem(CLAVE_ASISTENTE_FLOTANTE, 'false');
    TestBed.configureTestingModule({});

    const preferencias = TestBed.inject(PreferenciasInterfazService);

    expect(preferencias.asistenteFlotanteVisible()).toBe(false);
  });
});
