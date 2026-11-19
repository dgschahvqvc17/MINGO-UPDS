const { usuarioBusquedaSchema } = require('../src/models/usuario.model');
const { materiaBusquedaSchema } = require('../src/models/materia.model');
const {
  documentoBuscarSchema,
  MAXIMO_RESULTADOS_BUSQUEDA,
  TOP_K_BUSQUEDA,
} = require('../src/models/documento.model');

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

  describe('documentoBusquedaSchema', () => {
    it('convierte el limit en texto y aplica el tope por defecto', () => {
      const resultado = documentoBuscarSchema.parse({ q: 'derivadas' });

      expect(resultado).toEqual({ q: 'derivadas', limit: TOP_K_BUSQUEDA });
    });

    it('recorta un limit por encima del maximo en lugar de rechazarlo', () => {
      const resultado = documentoBuscarSchema.parse({ q: 'derivadas', limit: '500' });

      expect(resultado.limit).toBe(MAXIMO_RESULTADOS_BUSQUEDA);
    });

    it('acepta UUIDs validos para documento y materia', () => {
      const documentoId = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';
      const materiaId = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';

      const resultado = documentoBuscarSchema.parse({
        q: '  derivadas  ',
        documento_id: documentoId,
        materia_id: materiaId,
      });

      expect(resultado).toEqual({
        q: 'derivadas',
        documento_id: documentoId,
        materia_id: materiaId,
        limit: TOP_K_BUSQUEDA,
      });
    });

    it('rechaza una consulta de un solo caracter', () => {
      expect(() => documentoBuscarSchema.parse({ q: 'a' })).toThrow();
    });
  });
});
