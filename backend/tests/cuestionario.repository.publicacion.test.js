const CuestionarioRepository = require('../src/repositories/cuestionario.repository');

const USUARIO_ID = '3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01';
const OTRO_USUARIO_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const MATERIA_ID = '7a1b2c3d-4e5f-4a6b-8c9d-0e1f2a3b4c5d';
const CUESTIONARIO_ID = 'c1d2e3f4-5a6b-4c7d-8e9f-0a1b2c3d4e5f';

/**
 * Crea un cliente de Supabase minimalista para comprobar los filtros de
 * propiedad aplicados antes de publicar o consultar calificaciones.
 *
 * @param {{ usuarioId?: string }} opciones
 * @returns {{ supabase: object, filtros: Array<Array<string>> }}
 */
function crearSupabase({ usuarioId = USUARIO_ID } = {}) {
  const filtros = [];

  const crearCadena = (tabla, fila) => {
    const filtrosLocales = [];

    return {
      eq(columna, valor) {
        filtrosLocales.push([columna, valor]);
        filtros.push([tabla, columna, valor]);
        return this;
      },
      async maybeSingle() {
        const coincide = filtrosLocales.every(
          ([columna, valor]) => fila?.[columna] === valor,
        );
        return { data: coincide ? fila : null, error: null };
      },
    };
  };

  const supabase = {
    from(tabla) {
      if (tabla === 'cuestionarios') {
        const fila = {
          id: CUESTIONARIO_ID,
          usuario_id: usuarioId,
          materia_id: MATERIA_ID,
          publicado: false,
          fecha_publicacion: null,
        };
        return { select: () => crearCadena('cuestionarios', fila) };
      }

      if (tabla === 'materias') {
        return {
          select: () =>
            crearCadena('materias', { id: MATERIA_ID, docente_id: USUARIO_ID }),
        };
      }

      throw new Error(`Tabla inesperada: ${tabla}`);
    },
  };

  return { supabase, filtros };
}

/**
 * Crea un cliente de Supabase para comprobar que la actualización de
 * publicación también queda restringida al dueño del cuestionario.
 *
 * @returns {{ supabase: object, filtros: Array<Array<string>> }}
 */
function crearSupabaseParaActualizacion() {
  const filtros = [];
  let datosActualizados = {};
  const filaBase = {
    id: CUESTIONARIO_ID,
    usuario_id: USUARIO_ID,
    materia_id: MATERIA_ID,
    publicado: false,
    fecha_publicacion: null,
  };

  const cadena = {
    update(datos) {
      datosActualizados = datos;
      return this;
    },
    eq(columna, valor) {
      filtros.push([columna, valor]);
      return this;
    },
    select() {
      return this;
    },
    async maybeSingle() {
      const coincide = filtros.every(([columna, valor]) => filaBase[columna] === valor);
      return {
        data: coincide ? { ...filaBase, ...datosActualizados } : null,
        error: null,
      };
    },
  };

  const supabase = {
    from(tabla) {
      if (tabla !== 'cuestionarios') {
        throw new Error(`Tabla inesperada: ${tabla}`);
      }
      return { update: (datos) => cadena.update(datos) };
    },
  };

  return { supabase, filtros };
}

describe('CuestionarioRepository - publicación segura', () => {
  it('permite al docente dueño consultar su cuestionario', async () => {
    const { supabase, filtros } = crearSupabase();
    const repositorio = new CuestionarioRepository({ supabase });

    const cuestionario = await repositorio.obtenerCuestionarioParaDocente(
      USUARIO_ID,
      CUESTIONARIO_ID,
    );

    expect(cuestionario).toMatchObject({ id: CUESTIONARIO_ID });
    expect(filtros).toContainEqual(['cuestionarios', 'usuario_id', USUARIO_ID]);
    expect(filtros).toContainEqual(['materias', 'docente_id', USUARIO_ID]);
  });

  it('no devuelve un cuestionario generado por otra persona', async () => {
    const { supabase, filtros } = crearSupabase({ usuarioId: OTRO_USUARIO_ID });
    const repositorio = new CuestionarioRepository({ supabase });

    const cuestionario = await repositorio.obtenerCuestionarioParaDocente(
      USUARIO_ID,
      CUESTIONARIO_ID,
    );

    expect(cuestionario).toBeNull();
    expect(filtros).toContainEqual(['cuestionarios', 'usuario_id', USUARIO_ID]);
    expect(filtros).not.toContainEqual(['materias', 'docente_id', USUARIO_ID]);
  });

  it('filtra la actualización de publicación por el usuario dueño', async () => {
    const { supabase, filtros } = crearSupabaseParaActualizacion();
    const repositorio = new CuestionarioRepository({ supabase });

    const actualizado = await repositorio.actualizarPublicacion({
      usuarioId: USUARIO_ID,
      cuestionarioId: CUESTIONARIO_ID,
      materiaId: MATERIA_ID,
      publicado: true,
    });

    expect(actualizado).toMatchObject({ id: CUESTIONARIO_ID, publicado: true });
    expect(filtros).toContainEqual(['id', CUESTIONARIO_ID]);
    expect(filtros).toContainEqual(['usuario_id', USUARIO_ID]);
    expect(filtros).toContainEqual(['materia_id', MATERIA_ID]);
  });
});
