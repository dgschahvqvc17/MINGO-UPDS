const { describe, it, expect, jest: j } = require('@jest/globals');
const UsuarioAdminRepository = require('../src/repositories/usuario-admin.repository');

/**
 * Constructor de consultas encadenables que imita al cliente de Supabase.
 * Cada método devuelve el mismo builder y al esperarlo resuelve la respuesta.
 */
function crearBuilder(respuesta) {
  const builder = {};

  for (const metodo of [
    'select',
    'or',
    'eq',
    'in',
    'order',
    'range',
    'insert',
    'update',
    'delete',
    'maybeSingle',
  ]) {
    builder[metodo] = j.fn(() => builder);
  }

  builder.then = (resolver, rechazar) => Promise.resolve(respuesta).then(resolver, rechazar);

  return builder;
}

/**
 * Cliente falso que entrega una respuesta por tabla en el orden en que se
 * solicitan. Guarda cada builder para poder inspeccionar los filtros.
 */
function crearSupabaseFalso(respuestasPorTabla = {}) {
  const colas = new Map();
  const consultas = [];

  for (const [tabla, respuestas] of Object.entries(respuestasPorTabla)) {
    colas.set(tabla, [...respuestas]);
  }

  const supabase = {
    consultas,
    from: j.fn((tabla) => {
      const cola = colas.get(tabla) ?? [];
      const respuesta = cola.length > 0 ? cola.shift() : { data: [], error: null, count: 0 };
      const builder = crearBuilder(respuesta);
      consultas.push({ tabla, builder });
      return builder;
    }),
  };

  return supabase;
}

function consultasDe(supabase, tabla) {
  return supabase.consultas.filter((consulta) => consulta.tabla === tabla);
}

describe('UsuarioAdminRepository', () => {
  describe('listarUsuarios', () => {
    it('devuelve los roles como arreglo de nombres y pagina por rango', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [
          {
            data: [
              {
                id: 'usuario-1',
                nombre: 'Ana',
                apellido: 'Quispe',
                correo: 'ana@mingo.test',
                estado: 'activo',
                usuario_roles: [{ roles: { id: 1, nombre: 'estudiante' } }],
              },
              {
                id: 'usuario-2',
                nombre: 'Luis',
                apellido: 'Rojas',
                correo: 'luis@mingo.test',
                estado: 'activo',
                usuario_roles: [],
              },
            ],
            error: null,
          },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);
      const usuarios = await repositorio.listarUsuarios({ limit: 20, offset: 40 });

      expect(usuarios).toEqual([
        expect.objectContaining({ id: 'usuario-1', roles: ['estudiante'] }),
        expect.objectContaining({ id: 'usuario-2', roles: [] }),
      ]);
      expect(usuarios[0]).not.toHaveProperty('usuario_roles');

      const [consulta] = consultasDe(supabase, 'perfiles');
      expect(consulta.builder.range).toHaveBeenCalledWith(40, 59);
      expect(consulta.builder.order).toHaveBeenCalledWith('fecha_creacion', { ascending: false });
    });

    it('sanea el término de búsqueda antes de usarlo en el filtro or', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ data: [], error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);
      await repositorio.listarUsuarios({ query: 'Ana,(Pérez)%' });

      const [consulta] = consultasDe(supabase, 'perfiles');
      expect(consulta.builder.or).toHaveBeenCalledWith(
        'nombre.ilike.%Ana Pérez%,apellido.ilike.%Ana Pérez%,correo.ilike.%Ana Pérez%',
      );
    });

    it('usa un join interno al filtrar por rol', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ data: [], error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);
      await repositorio.listarUsuarios({ rol: 'administrador', estado: 'activo' });

      const [consulta] = consultasDe(supabase, 'perfiles');
      expect(consulta.builder.select).toHaveBeenCalledWith(
        expect.stringContaining('usuario_roles!inner'),
      );
      expect(consulta.builder.eq).toHaveBeenCalledWith('estado', 'activo');
      expect(consulta.builder.eq).toHaveBeenCalledWith(
        'usuario_roles.roles.nombre',
        'administrador',
      );
    });

    it('propaga el error del cliente', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [{ data: null, error: { message: 'sin conexión' } }],
      });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.listarUsuarios({})).rejects.toThrow(
        'Error al listar usuarios: sin conexión',
      );
    });
  });

  describe('obtenerUsuarioPorId', () => {
    it('devuelve el detalle de roles del usuario', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [
          {
            data: {
              id: 'usuario-1',
              nombre: 'Ana',
              usuario_roles: [
                { roles: { id: 1, nombre: 'estudiante', descripcion: 'Estudiante' } },
              ],
            },
            error: null,
          },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);
      const usuario = await repositorio.obtenerUsuarioPorId('usuario-1');

      expect(usuario.roles_detalle).toEqual([
        { id: 1, nombre: 'estudiante', descripcion: 'Estudiante' },
      ]);
      expect(usuario).not.toHaveProperty('usuario_roles');
    });

    it('devuelve null cuando el usuario no existe', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ data: null, error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.obtenerUsuarioPorId('inexistente')).resolves.toBeNull();
    });
  });

  describe('obtenerRolesDisponibles', () => {
    it('ordena los roles por nombre', async () => {
      const supabase = crearSupabaseFalso({
        roles: [
          {
            data: [
              { id: 2, nombre: 'administrador', descripcion: null },
              { id: 1, nombre: 'estudiante', descripcion: null },
            ],
            error: null,
          },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);
      const roles = await repositorio.obtenerRolesDisponibles();

      expect(roles).toHaveLength(2);
      expect(consultasDe(supabase, 'roles')[0].builder.order).toHaveBeenCalledWith('nombre', {
        ascending: true,
      });
    });
  });

  describe('actualizarRolesUsuario', () => {
    it('agrega los roles nuevos y quita los que ya no corresponden', async () => {
      const supabase = crearSupabaseFalso({
        roles: [{ data: [{ id: 2, nombre: 'administrador' }], error: null }],
        usuario_roles: [
          { data: [{ rol_id: 1 }], error: null },
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);
      await repositorio.actualizarRolesUsuario('usuario-1', ['administrador']);

      const [, insert, borrado] = consultasDe(supabase, 'usuario_roles').map(
        (consulta) => consulta.builder,
      );

      expect(insert.insert).toHaveBeenCalledWith([{ usuario_id: 'usuario-1', rol_id: 2 }]);
      expect(borrado.delete).toHaveBeenCalled();
      expect(borrado.in).toHaveBeenCalledWith('rol_id', [1]);
    });

    it('rechaza un rol que no existe', async () => {
      const supabase = crearSupabaseFalso({
        roles: [{ data: [{ id: 1, nombre: 'estudiante' }], error: null }],
      });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(
        repositorio.actualizarRolesUsuario('usuario-1', ['estudiante', 'profesor']),
      ).rejects.toThrow('Roles no encontrados: profesor');
    });

    it('restaura los roles anteriores si falla la escritura', async () => {
      const supabase = crearSupabaseFalso({
        roles: [{ data: [{ id: 2, nombre: 'administrador' }], error: null }],
        usuario_roles: [
          { data: [{ rol_id: 1 }], error: null },
          { data: null, error: { message: 'fallo de escritura' } },
          { data: null, error: null },
          { data: null, error: null },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(
        repositorio.actualizarRolesUsuario('usuario-1', ['administrador']),
      ).rejects.toThrow('Error al actualizar roles: fallo de escritura');

      const consultas = consultasDe(supabase, 'usuario_roles').map((consulta) => consulta.builder);
      const restauracion = consultas[consultas.length - 1];

      expect(restauracion.insert).toHaveBeenCalledWith([{ usuario_id: 'usuario-1', rol_id: 1 }]);
    });
  });

  describe('actualizarEstadoUsuario', () => {
    it('actualiza el estado del perfil', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ data: null, error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);
      await repositorio.actualizarEstadoUsuario('usuario-1', 'inactivo');

      const [consulta] = consultasDe(supabase, 'perfiles');
      expect(consulta.builder.update).toHaveBeenCalledWith({ estado: 'inactivo' });
      expect(consulta.builder.eq).toHaveBeenCalledWith('id', 'usuario-1');
    });

    it('propaga el error del cliente', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [{ data: null, error: { message: 'sin permisos' } }],
      });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.actualizarEstadoUsuario('usuario-1', 'activo')).rejects.toThrow(
        'Error al actualizar estado: sin permisos',
      );
    });
  });

  describe('existeUsuario', () => {
    it('devuelve true cuando el conteo es mayor que cero', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ count: 1, error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.existeUsuario('usuario-1')).resolves.toBe(true);
    });

    it('devuelve false cuando no hay coincidencias', async () => {
      const supabase = crearSupabaseFalso({ perfiles: [{ count: 0, error: null }] });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.existeUsuario('usuario-1')).resolves.toBe(false);
    });
  });

  describe('obtenerEstadisticas', () => {
    it('normaliza los seis contadores', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [{ count: 10, error: null }, { count: 8, error: null }, { count: 2, error: null }],
        usuario_roles: [
          { count: 2, error: null },
          { count: 3, error: null },
          { count: 8, error: null },
        ],
      });

      const repositorio = new UsuarioAdminRepository(supabase);
      const estadisticas = await repositorio.obtenerEstadisticas();

      expect(estadisticas).toEqual({
        total_usuarios: 10,
        usuarios_activos: 8,
        usuarios_inactivos: 2,
        total_administradores: 2,
        total_docentes: 3,
        total_estudiantes: 8,
      });
    });

    it('propaga el primer error encontrado', async () => {
      const supabase = crearSupabaseFalso({
        perfiles: [
          { count: 10, error: null },
          { count: null, error: { message: 'consulta fallida' } },
          { count: 2, error: null },
        ],
        usuario_roles: [{ count: 2, error: null }, { count: 8, error: null }],
      });

      const repositorio = new UsuarioAdminRepository(supabase);

      await expect(repositorio.obtenerEstadisticas()).rejects.toThrow(
        'Error al obtener estadísticas: consulta fallida',
      );
    });
  });

  describe('sin cliente de Supabase', () => {
    it('falla con un mensaje claro', async () => {
      const repositorio = new UsuarioAdminRepository(null);

      await expect(repositorio.listarUsuarios({})).rejects.toThrow(
        'Supabase no esta configurado en el servidor.',
      );
    });
  });
});
