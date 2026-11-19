const { describe, it, expect } = require('@jest/globals');
const {
  ESTADOS_EN_PROCESO,
  MINUTOS_ESTANCADO,
  calcularCorte,
  estaEnProceso,
  estaEstancado,
} = require('../src/utils/procesamiento-estado');

const AHORA = new Date('2026-11-16T12:00:00.000Z');

describe('procesamiento-estado', () => {
  describe('estaEnProceso', () => {
    it('reconoce los estados con trabajo pendiente o en ejecucion', () => {
      expect(ESTADOS_EN_PROCESO).toEqual(['en_cola', 'procesando']);
      expect(estaEnProceso('en_cola')).toBe(true);
      expect(estaEnProceso('procesando')).toBe(true);
    });

    it('descarta los estados terminales y los vacios', () => {
      expect(estaEnProceso('pendiente')).toBe(false);
      expect(estaEnProceso('procesado')).toBe(false);
      expect(estaEnProceso('error')).toBe(false);
      expect(estaEnProceso(null)).toBe(false);
      expect(estaEnProceso(undefined)).toBe(false);
    });
  });

  describe('calcularCorte', () => {
    it('resta la ventana de estancamiento a la hora actual', () => {
      expect(calcularCorte({ ahora: AHORA })).toBe('2026-11-16T11:45:00.000Z');
      expect(MINUTOS_ESTANCADO).toBe(15);
    });

    it('permite ajustar los minutos para pruebas', () => {
      expect(calcularCorte({ ahora: AHORA, minutos: 5 })).toBe('2026-11-16T11:55:00.000Z');
    });
  });

  describe('estaEstancado', () => {
    it('no considera atascado un documento fuera de proceso', () => {
      const documento = {
        estado_procesamiento: 'procesado',
        fecha_actualizacion: '2026-11-16T10:00:00.000Z',
      };

      expect(estaEstancado(documento, { ahora: AHORA })).toBe(false);
    });

    it('considera atascado un documento en proceso sin actualizaciones recientes', () => {
      const documento = {
        estado_procesamiento: 'procesando',
        fecha_actualizacion: '2026-11-16T10:00:00.000Z',
      };

      expect(estaEstancado(documento, { ahora: AHORA })).toBe(true);
    });

    it('no considera atascado un documento actualizado dentro de la ventana', () => {
      const documento = {
        estado_procesamiento: 'en_cola',
        fecha_actualizacion: '2026-11-16T11:50:00.000Z',
      };

      expect(estaEstancado(documento, { ahora: AHORA })).toBe(false);
    });

    it('considera atascado un documento sin fecha de actualizacion', () => {
      const documento = { estado_procesamiento: 'en_cola', fecha_actualizacion: null };

      expect(estaEstancado(documento, { ahora: AHORA })).toBe(true);
    });

    it('considera atascado un documento con fecha invalida', () => {
      const documento = {
        estado_procesamiento: 'en_cola',
        fecha_actualizacion: 'no-es-fecha',
      };

      expect(estaEstancado(documento, { ahora: AHORA })).toBe(true);
    });

    it('trata un documento ausente como no atascado', () => {
      expect(estaEstancado(null, { ahora: AHORA })).toBe(false);
      expect(estaEstancado(undefined, { ahora: AHORA })).toBe(false);
    });
  });
});
