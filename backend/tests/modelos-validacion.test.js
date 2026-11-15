const { usuarioBusquedaSchema } = require('../src/models/usuario.model');
const { materiaBusquedaSchema } = require('../src/models/materia.model');

/**
 * Los parametros de consulta llegan siempre como texto. Si los esquemas no
 * convierten el tipo, un `?limit=20` valido termina en 400 y la pantalla que
 * consume el endpoint queda vacia.
 */
describe('Esquemas de busqueda con parametros de consulta en texto', () => {
  describe('usuarioBusquedaSchema', () => {
    it('convierte limit y offset enviados como texto', () => {
      const resultado = usuarioBusquedaSchema.parse({ limit: '20', offset: '0' });

      expect(resultado).toEqual({ limit: 20, offset: 0 });
    });

    it('aplica los valores por defecto cuando no se envia paginacion', () => {
      const resultado = usuarioBusquedaSchema.parse({});

      expect(resultado).toEqual({ limit: 50, offset: 0 });
    });

    it('rechaza un limite mayor al maximo permitido', () => {
      expect(() => usuarioBusquedaSchema.parse({ limit: '500' })).toThrow();
    });
  });

  describe('materiaBusquedaSchema', () => {
    it('acepta el limite de 100 que usa el frontend', () => {
      const resultado = materiaBusquedaSchema.parse({ limit: '100' });

      expect(resultado.limit).toBe(100);
    });

    it('rechaza un limite mayor a 100', () => {
      expect(() => materiaBusquedaSchema.parse({ limit: '101' })).toThrow();
    });
  });
});
