const { describe, it, expect, beforeEach, jest: j } = require('@jest/globals');
const ApiError = require('../src/utils/ApiError');
const UsuarioAdminService = require('../src/services/usuario-admin.service');

describe('UsuarioAdminService', () => {
  let mockRepository;
  let service;
  const usuarioActualId = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => {
    mockRepository = {
      listarUsuarios: j.fn(),
      obtenerUsuarioPorId: j.fn(),
      obtenerRolesDisponibles: j.fn(),
      actualizarRolesUsuario: j.fn(),
      actualizarEstadoUsuario: j.fn(),
      existeUsuario: j.fn(),
      obtenerEstadisticas: j.fn(),
      obtenerRolesUsuario: j.fn(),
      obtenerEstadoUsuario: j.fn(),
    };

    service = new UsuarioAdminService(mockRepository, usuarioActualId);
  });

  describe('listarUsuarios', () => {
    it('should return users with statistics', async () => {
      const mockUsuarios = [
        {
          id: 'user1',
          nombre: 'Juan',
          apellido: 'Pérez',
          correo: 'juan@universidad.edu',
          carrera: 'Ingeniería',
          estado: 'activo',
          fecha_creacion: '2024-01-15T10:30:00Z',
          roles: ['estudiante']
        }
      ];

      const mockEstadisticas = {
        total_usuarios: '10',
        usuarios_activos: '8',
        usuarios_inactivos: '2',
        total_administradores: '2',
        total_estudiantes: '8'
      };

      mockRepository.listarUsuarios.mockResolvedValue(mockUsuarios);
      mockRepository.obtenerEstadisticas.mockResolvedValue(mockEstadisticas);

      const result = await service.listarUsuarios({ limit: 20, offset: 0 });

      expect(result.usuarios).toEqual(mockUsuarios);
      expect(result.paginacion).toEqual({
        limit: 20,
        offset: 0,
        total: 10
      });
      expect(result.estadisticas).toEqual({
        total: 10,
        activos: 8,
        inactivos: 2,
        administradores: 2,
        estudiantes: 8
      });
    });

    it('should throw ApiError on repository error', async () => {
      mockRepository.listarUsuarios.mockRejectedValue(new Error('DB Error'));

      await expect(service.listarUsuarios()).rejects.toThrow(ApiError);
      await expect(service.listarUsuarios()).rejects.toThrow('Error al listar usuarios');
    });
  });

  describe('obtenerUsuario', () => {
    it('should return user when found', async () => {
      const mockUsuario = {
        id: 'user1',
        nombre: 'Juan',
        apellido: 'Pérez',
        correo: 'juan@universidad.edu',
        estado: 'activo',
        roles_detalle: [{ id: 1, nombre: 'estudiante', descripcion: 'Estudiante' }]
      };

      mockRepository.obtenerUsuarioPorId.mockResolvedValue(mockUsuario);

      const result = await service.obtenerUsuario('user1');

      expect(result).toEqual(mockUsuario);
    });

    it('should throw ApiError when user not found', async () => {
      mockRepository.obtenerUsuarioPorId.mockResolvedValue(null);

      await expect(service.obtenerUsuario('nonexistent')).rejects.toThrow(ApiError);
      await expect(service.obtenerUsuario('nonexistent')).rejects.toThrow('Usuario no encontrado');
    });
  });

  describe('obtenerRolesDisponibles', () => {
    it('should return available roles', async () => {
      const mockRoles = [
        { id: 1, nombre: 'administrador', descripcion: 'Administrador' },
        { id: 2, nombre: 'estudiante', descripcion: 'Estudiante' }
      ];

      mockRepository.obtenerRolesDisponibles.mockResolvedValue(mockRoles);

      const result = await service.obtenerRolesDisponibles();

      expect(result).toEqual(mockRoles);
    });

    it('should throw ApiError on repository error', async () => {
      mockRepository.obtenerRolesDisponibles.mockRejectedValue(new Error('DB Error'));

      await expect(service.obtenerRolesDisponibles()).rejects.toThrow(ApiError);
      await expect(service.obtenerRolesDisponibles()).rejects.toThrow('Error al obtener roles');
    });
  });

  describe('actualizarRolesUsuario', () => {
    const usuarioId = 'user2';

    beforeEach(() => {
      mockRepository.existeUsuario.mockResolvedValue(true);
      mockRepository.obtenerUsuarioPorId.mockResolvedValue({
        id: usuarioId,
        roles_detalle: [{ nombre: 'estudiante' }]
      });
      mockRepository.obtenerEstadisticas.mockResolvedValue({
        total_administradores: '2'
      });
    });

    it('should update user roles successfully', async () => {
      const newRoles = ['estudiante', 'administrador'];

      const result = await service.actualizarRolesUsuario(usuarioId, newRoles);

      expect(result.mensaje).toBe('Roles actualizados exitosamente');
      expect(result.usuarioId).toBe(usuarioId);
      expect(result.roles).toEqual(newRoles);
      expect(result.operacion).toBeDefined();
      expect(mockRepository.actualizarRolesUsuario).toHaveBeenCalledWith(usuarioId, newRoles);
    });

    it('should throw forbidden error when trying to modify own roles', async () => {
      await expect(service.actualizarRolesUsuario(usuarioActualId, ['administrador']))
        .rejects.toThrow(ApiError);
      await expect(service.actualizarRolesUsuario(usuarioActualId, ['administrador']))
        .rejects.toThrow('No puedes modificar tus propios privilegios');
    });

    it('should throw not found error when user does not exist', async () => {
      mockRepository.existeUsuario.mockResolvedValue(false);

      await expect(service.actualizarRolesUsuario('nonexistent', ['estudiante']))
        .rejects.toThrow(ApiError);
      await expect(service.actualizarRolesUsuario('nonexistent', ['estudiante']))
        .rejects.toThrow('Usuario no encontrado');
    });

    it('should throw forbidden error when removing only administrator', async () => {
      mockRepository.obtenerUsuarioPorId.mockResolvedValue({
        id: usuarioId,
        roles_detalle: [{ nombre: 'administrador' }]
      });
      mockRepository.obtenerEstadisticas.mockResolvedValue({
        total_administradores: '1'
      });

      await expect(service.actualizarRolesUsuario(usuarioId, ['estudiante']))
        .rejects.toThrow(ApiError);
      await expect(service.actualizarRolesUsuario(usuarioId, ['estudiante']))
        .rejects.toThrow('No se puede remover al único administrador del sistema');
    });
  });

  describe('actualizarEstadoUsuario', () => {
    const usuarioId = 'user2';

    beforeEach(() => {
      mockRepository.existeUsuario.mockResolvedValue(true);
      mockRepository.obtenerUsuarioPorId.mockResolvedValue({
        id: usuarioId,
        roles_detalle: [{ nombre: 'estudiante' }]
      });
      mockRepository.obtenerEstadisticas.mockResolvedValue({
        total_administradores: '2'
      });
    });

    it('should update user status successfully', async () => {
      const result = await service.actualizarEstadoUsuario(usuarioId, 'inactivo');

      expect(result.mensaje).toBe('Usuario desactivado exitosamente');
      expect(result.usuarioId).toBe(usuarioId);
      expect(result.estado).toBe('inactivo');
      expect(result.operacion).toBeDefined();
      expect(mockRepository.actualizarEstadoUsuario).toHaveBeenCalledWith(usuarioId, 'inactivo');
    });

    it('should throw forbidden error when trying to modify own status', async () => {
      await expect(service.actualizarEstadoUsuario(usuarioActualId, 'inactivo'))
        .rejects.toThrow(ApiError);
      await expect(service.actualizarEstadoUsuario(usuarioActualId, 'inactivo'))
        .rejects.toThrow('No puedes modificar tu propio estado');
    });

    it('should throw forbidden error when deactivating only administrator', async () => {
      mockRepository.obtenerUsuarioPorId.mockResolvedValue({
        id: usuarioId,
        roles_detalle: [{ nombre: 'administrador' }]
      });
      mockRepository.obtenerEstadisticas.mockResolvedValue({
        total_administradores: '1'
      });

      await expect(service.actualizarEstadoUsuario(usuarioId, 'inactivo'))
        .rejects.toThrow(ApiError);
      await expect(service.actualizarEstadoUsuario(usuarioId, 'inactivo'))
        .rejects.toThrow('No se puede desactivar al único administrador del sistema');
    });
  });

  describe('buscarUsuarios', () => {
    it('should search users by term', async () => {
      const mockUsuarios = [
        {
          id: 'user1',
          nombre: 'Juan',
          apellido: 'Pérez',
          correo: 'juan@universidad.edu',
          estado: 'activo',
          fecha_creacion: '2024-01-15T10:30:00Z',
          roles: ['estudiante']
        }
      ];

      mockRepository.listarUsuarios.mockResolvedValue(mockUsuarios);

      const result = await service.buscarUsuarios('Juan', 10);

      expect(result).toEqual(mockUsuarios);
      expect(mockRepository.listarUsuarios).toHaveBeenCalledWith({
        query: 'Juan',
        limit: 10
      });
    });

    it('should throw ApiError on repository error', async () => {
      mockRepository.listarUsuarios.mockRejectedValue(new Error('DB Error'));

      await expect(service.buscarUsuarios('test', 10)).rejects.toThrow(ApiError);
      await expect(service.buscarUsuarios('test', 10)).rejects.toThrow('Error al buscar usuarios');
    });
  });
});