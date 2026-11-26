import { describe, expect, it } from 'vitest';
import { aFechaLocal, aIsoConZona } from './plan-estudio.model';

describe('modelo de planes de estudio', () => {
  it('conserva la fecha local al convertir a ISO con desplazamiento', () => {
    const fechaLocal = '2026-12-10T09:00';

    const iso = aIsoConZona(fechaLocal);

    expect(iso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00[+-]\d{2}:\d{2}$/);
    expect(iso.slice(0, 10)).toBe('2026-12-10');
    expect(new Date(iso).toISOString()).toBe(new Date(fechaLocal).toISOString());
    expect(aFechaLocal(iso)).toBe(fechaLocal);
  });

  it('devuelve una cadena vacia para una fecha local invalida', () => {
    expect(aIsoConZona('')).toBe('');
    expect(aIsoConZona('no-es-una-fecha')).toBe('');
  });
});
