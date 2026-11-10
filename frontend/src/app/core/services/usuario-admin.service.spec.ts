import { TestBed } from '@angular/core/testing';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { UsuarioAdminService, type UsuarioListado, type RolDisponible } from './usuario-admin.service';

describe('UsuarioAdminService', () => {
  let service: UsuarioAdminService;
  let httpMock: HttpTestingController;

  const mockUsuarios: UsuarioListado[] = [
    {
      id: '550e8400-e29b-41d4-a716-446655440000',
      nombre: 'Juan',
      apellido: 'Pérez',
      correo: 'juan@universidad.edu',
      carrera: 'Ingeniería Informática',
      estado: 'activo',
      fecha_creacion: '2024-01-15T10:30:00Z',
      roles: ['estudiante']
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      nombre: 'María',
      apellido: 'Gómez',
      correo: 'maria@universidad.edu',
      carrera: 'Matemáticas',
      estado: 'activo',
      fecha_creacion: '2024-01-20T14:45:00Z',
      roles: ['administrador']
    }
  ];

  const mockRoles: RolDisponible[] = [
    {
      id: 1,
      nombre: 'administrador',
      descripcion: 'Administrador del sistema'
    },
    {
      id: 2,
      nombre: 'estudiante',
      descripcion: 'Usuario estudiante'
    }
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [],
      providers: [
        UsuarioAdminService,
        provideHttpClient(withInterceptorsFromDi()),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UsuarioAdminService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('listarUsuarios', () => {
    it('should fetch users with default parameters', () => {
      const mockResponse = {
        usuarios: mockUsuarios,
        paginacion: { limit: 50, offset: 0, total: 2 },
        estadisticas: { total: 2, activos: 2, inactivos: 0, administradores: 1, estudiantes: 1 }
      };

      service.listarUsuarios().subscribe(response => {
        expect(response.usuarios.length).toBe(2);
        expect(response.usuarios[0].nombre).toBe('Juan');
        expect(response.paginacion.total).toBe(2);
      });

      const req = httpMock.expectOne('/api/usuarios');
      expect(req.request.method).toBe('GET');
      expect(req.request.params.keys().length).toBe(0); // No query params por defecto
      req.flush({ success: true, data: mockResponse });
    });

    it('should fetch users with filters', () => {
      const mockResponse = {
        usuarios: [mockUsuarios[0]],
        paginacion: { limit: 20, offset: 0, total: 1 },
        estadisticas: { total: 1, activos: 1, inactivos: 0, administradores: 0, estudiantes: 1 }
      };

      const filters = {
        query: 'Juan',
        estado: 'activo' as const,
        rol: 'estudiante' as const,
        limit: 20,
        offset: 0
      };

      service.listarUsuarios(filters).subscribe(response => {
        expect(response.usuarios.length).toBe(1);
        expect(response.usuarios[0].nombre).toBe('Juan');
      });

      // La URL lleva query params: se compara solo la ruta y luego se validan los params.
      const req = httpMock.expectOne((request) => request.url === '/api/usuarios');

      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('query')).toBe('Juan');
      expect(req.request.params.get('estado')).toBe('activo');
      expect(req.request.params.get('rol')).toBe('estudiante');
      expect(req.request.params.get('limit')).toBe('20');
      expect(req.request.params.get('offset')).toBe('0');
      req.flush({ success: true, data: mockResponse });
    });
  });

  describe('obtenerUsuario', () => {
    it('should fetch a specific user by ID', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const mockUser = {
        ...mockUsuarios[0],
        roles_detalle: [
          { id: 2, nombre: 'estudiante', descripcion: 'Usuario estudiante' }
        ]
      };

      service.obtenerUsuario(userId).subscribe(user => {
        expect(user.id).toBe(userId);
        expect(user.nombre).toBe('Juan');
        expect(user.roles_detalle.length).toBe(1);
      });

      const req = httpMock.expectOne(`/api/usuarios/${userId}`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockUser });
    });
  });

  describe('obtenerRolesDisponibles', () => {
    it('should fetch available roles', () => {
      service.obtenerRolesDisponibles().subscribe(roles => {
        expect(roles.length).toBe(2);
        expect(roles[0].nombre).toBe('administrador');
        expect(roles[1].nombre).toBe('estudiante');
      });

      const req = httpMock.expectOne('/api/usuarios/roles');
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: mockRoles });
    });
  });

  describe('actualizarRolesUsuario', () => {
    it('should update user roles', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const roles = ['estudiante', 'administrador'] as Array<'estudiante' | 'administrador'>;
      const mockResponse = {
        mensaje: 'Roles actualizados exitosamente',
        usuarioId: userId,
        roles: roles
      };

      service.actualizarRolesUsuario(userId, roles).subscribe(response => {
        expect(response.mensaje).toBe('Roles actualizados exitosamente');
        expect(response.usuarioId).toBe(userId);
      });

      const req = httpMock.expectOne(`/api/usuarios/${userId}/roles`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ roles });
      req.flush({ success: true, data: mockResponse });
    });
  });

  describe('actualizarEstadoUsuario', () => {
    it('should update user status', () => {
      const userId = '550e8400-e29b-41d4-a716-446655440000';
      const estado = 'inactivo' as const;
      const mockResponse = {
        mensaje: 'Usuario desactivado exitosamente',
        usuarioId: userId,
        estado: estado
      };

      service.actualizarEstadoUsuario(userId, estado).subscribe(response => {
        expect(response.mensaje).toBe('Usuario desactivado exitosamente');
        expect(response.estado).toBe(estado);
      });

      const req = httpMock.expectOne(`/api/usuarios/${userId}/estado`);
      expect(req.request.method).toBe('PATCH');
      expect(req.request.body).toEqual({ estado });
      req.flush({ success: true, data: mockResponse });
    });
  });

  describe('buscarUsuarios', () => {
    it('should search users by term', () => {
      const termino = 'Juan';
      const limit = 10;

      service.buscarUsuarios(termino, limit).subscribe(usuarios => {
        expect(usuarios.length).toBe(1);
        expect(usuarios[0].nombre).toBe('Juan');
      });

      const req = httpMock.expectOne(`/api/usuarios/buscar?termino=${termino}&limit=${limit}`);
      expect(req.request.method).toBe('GET');
      req.flush({ success: true, data: [mockUsuarios[0]] });
    });
  });

  describe('helper methods', () => {
    const mockUsuario: UsuarioListado = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      nombre: 'Juan',
      apellido: 'Pérez',
      correo: 'juan@universidad.edu',
      carrera: 'Ingeniería Informática',
      estado: 'activo',
      fecha_creacion: '2024-01-15T10:30:00Z',
      roles: ['estudiante']
    };

    it('should format full name correctly', () => {
      const fullName = service.obtenerNombreCompleto(mockUsuario);
      expect(fullName).toBe('Juan Pérez');
    });

    it('should format roles text correctly', () => {
      const rolesText = service.obtenerRolesTexto(mockUsuario);
      expect(rolesText).toBe('Estudiante');
    });

    it('should format status text correctly', () => {
      const activeText = service.obtenerEstadoTexto('activo');
      const inactiveText = service.obtenerEstadoTexto('inactivo');
      expect(activeText).toBe('Activo');
      expect(inactiveText).toBe('Inactivo');
    });

    it('should return correct status badge class', () => {
      const activeClass = service.obtenerEstadoBadgeClase('activo');
      const inactiveClass = service.obtenerEstadoBadgeClase('inactivo');
      expect(activeClass).toBe('badge bg-success');
      expect(inactiveClass).toBe('badge bg-danger');
    });

    it('should return correct role badge class', () => {
      const adminClass = service.obtenerRolBadgeClase('administrador');
      const studentClass = service.obtenerRolBadgeClase('estudiante');
      expect(adminClass).toBe('badge bg-warning text-dark');
      expect(studentClass).toBe('badge bg-info');
    });

    it('should validate no self-modification correctly', () => {
      const result1 = service.validarNoAutoModificacion('user1', 'user2');
      const result2 = service.validarNoAutoModificacion('user1', 'user1');
      expect(result1).toBe(true);
      expect(result2).toBe(false);
    });

    it('should return correct validation message', () => {
      const validMessage = service.obtenerMensajeValidacion(true, 'editar');
      const invalidMessage = service.obtenerMensajeValidacion(false, 'editar');
      expect(validMessage).toBe('');
      expect(invalidMessage).toBe('No puedes editar tus propios privilegios');
    });
  });
});