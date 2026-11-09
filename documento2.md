# Documentación Técnica Backend: HU01 y HU02

## 📋 Descripción general

| Campo | Valor |
|---|---|
| **Proyecto** | MINGO - Plataforma Académica Inteligente |
| **Módulos documentados** | HU01: Inicio de sesión en el sistema<br>HU02: Administración de usuarios y roles |
| **Alcance del documento** | Backend (Node.js + Express 5) |
| **Stack backend** | Node.js 24, Express 5, CommonJS, Zod, Supabase (PostgreSQL + Auth), Jest + Supertest |
| **Arquitectura** | Por capas: `routes → controllers → services → repositories → infrastructure` |
| **Base de datos** | PostgreSQL en Supabase con RLS activo |
| **Autenticación** | Supabase Auth (JWT) |
| **Estado** | HU01 y HU02 implementadas; documentación de frontend fuera del alcance |

> **Nota de alcance:** este documento describe únicamente la implementación del **backend** de las historias HU01 y HU02. La pantalla de login, los guards, los interceptores y los componentes de administración del frontend no forman parte de este documento.

---

## 🎯 Historias de usuario implementadas

### HU01: Iniciar sesión en el sistema

**Como** usuario registrado, **quiero** iniciar sesión en el sistema utilizando mis credenciales para acceder a las funcionalidades correspondientes a mi rol.

**Objetivo backend:** validar el token emitido por Supabase Auth, verificar que la cuenta exista y esté habilitada, resolver el rol real desde la base de datos y devolver el perfil autenticado. Además, proteger todos los endpoints privados con el mismo mecanismo.

**Requerimientos funcionales y su cobertura en el backend**

| Requerimiento | Implementación backend |
|---|---|
| Autenticar al usuario mediante Supabase Auth | `authMiddleware` valida el JWT con `client.auth.getUser(token)`. |
| Verificar que el usuario se encuentre activo | `AuthService.buildAuthenticatedUser` rechaza `estado = 'inactivo'` con `403`. |
| Identificar el rol del usuario autenticado | `AuthService` consulta `usuario_roles` y `roles`; nunca lee el rol desde los metadatos del JWT. |
| Proteger las funcionalidades que requieren autenticación | `authMiddleware` se aplica a todos los routers privados. |
| Impedir el acceso a usuarios deshabilitados | La verificación se repite en cada solicitud, por lo que una cuenta desactivada pierde acceso de inmediato. |
| Permitir cerrar sesión de forma segura | El cierre de sesión se realiza en Supabase Auth; el backend deja de aceptar el token revocado. No se expone endpoint de logout. |
| Exponer el perfil autenticado | `GET /api/auth/me` devuelve `id`, `email`, `nombre`, `apellido`, `correo`, `estado`, `role` y `roles`. |

**Reglas de negocio**

- El `usuario_id` **siempre** se obtiene del token validado; nunca del cuerpo o de los parámetros enviados por el cliente.
- El rol **no** se toma de `user_metadata` ni de `app_metadata` del JWT: la fuente de verdad es la tabla `usuario_roles`.
- Si el usuario tiene varios roles, `administrador` tiene prioridad sobre `estudiante`.
- Un usuario sin roles válidos conserva el privilegio mínimo: `estudiante`.
- Un token válido sin perfil asociado responde `403`.
- Una cuenta con `estado = 'inactivo'` responde `403`.
- El registro y el login desde backend quedan fuera del alcance; el frontend usa el SDK de Supabase Auth.

---

### HU02: Administrar usuarios y roles

**Como** administrador, **quiero** administrar los usuarios y sus roles para controlar el acceso a las funcionalidades de MINGO.

**Objetivo backend:** exponer un módulo administrativo que permita listar, consultar, buscar, asignar roles y activar/desactivar usuarios, con validaciones de seguridad que impidan la auto-modificación y la pérdida del último administrador.

**Funcionalidades implementadas**

1. Listado paginado de usuarios con búsqueda y filtros.
2. Consulta detallada de un usuario con sus roles.
3. Búsqueda rápida por nombre, apellido o correo.
4. Consulta del catálogo de roles disponibles.
5. Actualización de roles de un usuario.
6. Activación y desactivación de usuarios.
7. Estadísticas para el panel administrativo.
8. Control de acceso exclusivo para administradores.
9. Validación de entradas con Zod.
10. Protección contra la auto-modificación y contra la eliminación del último administrador.

**Reglas de negocio**

- Solo usuarios con rol `administrador` acceden al módulo.
- Un usuario no puede modificar sus propios roles ni su propio estado.
- No se puede remover el rol `administrador` al último administrador del sistema.
- No se puede desactivar al último administrador del sistema.
- Los únicos roles válidos son `administrador` y `estudiante`.
- Un usuario no puede acumular múltiples roles de administrador.
- Un recurso inexistente responde `404`.
- Los cambios de roles se ejecutan en una transacción para evitar estados intermedios.
- Toda operación administrativa devuelve metadatos de auditoría (`operacion`).

---

## 🛠️ Configuración del entorno backend

### Requisitos

```bash
Node.js: 24.x
PostgreSQL: 15+ (Supabase)
npm: 10.x
```

### Instalación

```bash
git clone <repo-url>
cd MINGO/backend
npm install
cp .env.example .env
# Completar .env con las credenciales del proyecto de Supabase
npm run dev
```

### Variables de entorno

```env
# Entorno
NODE_ENV=development
PORT=4000
API_PREFIX=/api
CORS_ORIGINS=http://localhost:4200

# Supabase (Project Settings > API)
# SUPABASE_SERVICE_ROLE_KEY es opcional: solo para operaciones administrativas.
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AWS (solo servicios de la lista blanca, sin recursos ociosos)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=mingo-documentos
AWS_LAMBDA_FUNCTION_NAME=mingo-document-processor
AWS_SNS_TOPIC_ARN=
AWS_SQS_QUEUE_URL=

# Inteligencia artificial
AI_PROVIDER=openai
AI_API_KEY=
AI_BASE_URL=
AI_CHAT_MODEL=gpt-4o-mini
AI_EMBEDDING_MODEL=text-embedding-3-small
AI_EMBEDDING_DIMENSIONS=1536

# Límites
MAX_UPLOAD_MB=20
RATE_LIMIT_WINDOW_MINUTES=15
RATE_LIMIT_MAX_REQUESTS=300
```

**Reglas de configuración**

- `SUPABASE_URL` y `SUPABASE_ANON_KEY` son obligatorias en producción.
- HU01 funciona con el token del usuario y RLS; no requiere `service_role`.
- HU02 requiere `SUPABASE_SERVICE_ROLE_KEY` para las operaciones administrativas.
- La `service_role` nunca se expone al frontend ni se registra en logs.
- En `NODE_ENV=test` el backend ignora las credenciales reales y no llama a Supabase.

### Comandos

```bash
# Desarrollo
npm run dev

# Pruebas
npm test

# Lint
npm run lint

# Formato
npm run format
```

### Migración de base de datos

La implementación ejecutable de HU01 se encuentra en:

```text
supabase/migrations/0001_hu01_auth.sql
```

Se aplica desde el **SQL Editor** de Supabase o con la CLI. El script es idempotente y contiene tablas, catálogo de roles, trigger de registro, relleno de perfiles existentes y políticas RLS.

---

## 🏗️ Estructura del backend

```text
backend/
├── src/
│   ├── config/
│   │   ├── environment.js        # Validación de variables de entorno con Zod
│   │   └── supabase.js           # Clientes de Supabase (usuario y service_role)
│   ├── models/
│   │   └── usuario.model.js      # Esquemas Zod de HU02
│   ├── controllers/
│   │   ├── auth.controller.js    # HU01: perfil autenticado
│   │   └── usuario-admin.controller.js  # HU02: administración
│   ├── services/
│   │   ├── auth.service.js       # HU01: perfil, estado y roles
│   │   └── usuario-admin.service.js     # HU02: reglas de negocio
│   ├── repositories/
│   │   ├── usuario.repository.js        # HU01: lectura de perfil y roles
│   │   └── usuario-admin.repository.js  # HU02: consultas administrativas
│   ├── middlewares/
│   │   ├── auth.middleware.js           # HU01: valida JWT
│   │   ├── admin.middleware.js          # HU02: exige rol administrador
│   │   ├── no-self-modification.middleware.js  # HU02
│   │   ├── validation.middleware.js     # Validación Zod reutilizable
│   │   └── error.middleware.js          # Manejo central de errores
│   ├── routes/
│   │   ├── index.js                     # Router principal
│   │   ├── auth.routes.js               # HU01
│   │   └── usuario.routes.js            # HU02
│   ├── utils/
│   │   ├── ApiError.js
│   │   └── asyncHandler.js
│   ├── container.js                     # Composición de dependencias
│   ├── app.js                           # App Express exportada para pruebas
│   └── server.js                        # Arranque local
├── tests/
│   ├── auth.middleware.test.js
│   ├── auth.routes.test.js
│   ├── auth.service.test.js
│   ├── health.test.js
│   └── usuario-admin.service.test.js
└── package.json
```

### Dirección de dependencias

```text
route → controller → service → repository → infrastructure
```

| Capa | Responsabilidad | Prohibido |
|---|---|---|
| `route` | Método, ruta y middlewares. | Lógica de negocio o consultas. |
| `controller` | Traducir HTTP, validar y responder. | SQL o reglas complejas. |
| `service` | Reglas de negocio y autorización de dominio. | `req`, `res` o SQL directo. |
| `repository` | Acceso a datos y mapeo de filas. | HTTP o reglas de negocio. |
| `middleware` | Autenticación, roles, validación y errores. | Lógica de un módulo específico. |

---

## 🗄️ Modelo de datos compartido

HU01 y HU02 comparten las tablas de identidad: `perfiles`, `roles` y `usuario_roles`.

```sql
create table if not exists public.perfiles (
  id uuid primary key references auth.users (id) on delete cascade,
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  nombre varchar(100) not null default '',
  apellido varchar(100) not null default '',
  correo varchar(255) not null unique,
  carrera varchar(120),
  estado varchar(20) not null default 'activo',
  fecha_creacion timestamptz not null default now(),
  constraint perfiles_auth_user_id_coincide check (auth_user_id = id),
  constraint perfiles_estado_check check (estado in ('activo', 'inactivo'))
);

create table if not exists public.roles (
  id serial primary key,
  nombre varchar(50) not null unique,
  descripcion text
);

create table if not exists public.usuario_roles (
  id serial primary key,
  usuario_id uuid not null references public.perfiles (id) on delete cascade,
  rol_id integer not null references public.roles (id) on delete restrict,
  unique (usuario_id, rol_id)
);
```

**Catálogo de roles**

```sql
insert into public.roles (nombre, descripcion)
values
  ('estudiante', 'Acceso a su espacio academico personal.'),
  ('administrador', 'Acceso al panel administrativo y a la gestion de usuarios.')
on conflict (nombre) do nothing;
```

**Tipos de identificadores**

| Tabla | Clave primaria |
|---|---|
| `perfiles` | `UUID`, igual a `auth.users.id`. |
| `roles` | `SERIAL`. |
| `usuario_roles` | `SERIAL`, con unicidad en `(usuario_id, rol_id)`. |

### Trigger de registro

Al crear un usuario en Supabase Auth se crea su perfil y se le asigna el rol `estudiante` por defecto.

```sql
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rol_estudiante_id integer;
begin
  insert into public.perfiles (id, auth_user_id, nombre, apellido, correo)
  values (
    new.id,
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nombre', ''),
    coalesce(new.raw_user_meta_data ->> 'apellido', ''),
    coalesce(new.email, new.id::text || '@sin-correo.mingo')
  )
  on conflict (id) do nothing;

  select id into rol_estudiante_id
  from public.roles
  where nombre = 'estudiante';

  if rol_estudiante_id is not null then
    insert into public.usuario_roles (usuario_id, rol_id)
    values (new.id, rol_estudiante_id)
    on conflict (usuario_id, rol_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
```

### RLS

```sql
alter table public.perfiles enable row level security;
alter table public.roles enable row level security;
alter table public.usuario_roles enable row level security;

create policy perfiles_select_propio
  on public.perfiles
  for select
  to authenticated
  using (auth.uid() = id);

create policy roles_select_autenticados
  on public.roles
  for select
  to authenticated
  using (true);

create policy usuario_roles_select_propio
  on public.usuario_roles
  for select
  to authenticated
  using (auth.uid() = usuario_id);

grant select on public.perfiles, public.roles, public.usuario_roles to authenticated;
revoke insert, update, delete
  on public.perfiles, public.roles, public.usuario_roles
  from anon, authenticated;
```

**Decisiones de seguridad**

- El usuario autenticado solo puede **leer** su propio perfil y sus propios roles.
- No existe una política `for all` sobre `usuario_roles`, porque permitiría que un estudiante se asignara el rol `administrador`.
- La escritura de perfiles y roles se realiza desde el backend con `service_role` después de validar el rol del solicitante.
- En HU01 se usa el cliente del usuario para que RLS se aplique también en la lectura del perfil.

---

## 🔐 HU01: Inicio de sesión en el sistema

### 1. Flujo de autenticación

1. El usuario se autentica contra Supabase Auth desde el cliente y obtiene un `access_token`.
2. El cliente envía el token al backend en el encabezado `Authorization: Bearer <access_token>`.
3. `authMiddleware` valida el token con Supabase y obtiene el usuario de Auth.
4. `AuthService.buildAuthenticatedUser` consulta el perfil en `perfiles` y los roles en `usuario_roles`.
5. Si el perfil no existe o la cuenta está inactiva, responde `403`.
6. Si todo es válido, adjunta `req.user` y `req.accessToken` y continúa la solicitud.
7. `GET /api/auth/me` devuelve el perfil autenticado con su rol.

```text
Cliente ──Bearer JWT──> authMiddleware ──> Supabase Auth (getUser)
                                │
                                ├──> perfiles (estado)
                                └──> usuario_roles + roles
                                │
                                v
                        req.user { id, email, role, estado, roles }
                                │
                                v
                        Controller / ruta protegida
```

### 2. Endpoint `GET /api/auth/me`

**Request**

```http
GET /api/auth/me
Authorization: Bearer <access_token>
```

**Respuesta `200`**

```json
{
  "success": true,
  "data": {
    "id": "3f2b7e5c-1a4d-4c8e-9f10-2b6d8a7c9e01",
    "email": "ana@universidad.edu",
    "nombre": "Ana",
    "apellido": "Perez",
    "correo": "ana@universidad.edu",
    "estado": "activo",
    "role": "estudiante",
    "roles": ["estudiante"]
  }
}
```

**Errores**

| Código | Causa |
|---|---|
| `401` | Token ausente, vacío, inválido o expirado. |
| `403` | Perfil inexistente o cuenta con `estado = 'inactivo'`. |
| `503` | Supabase Auth no está configurado en el backend. |

### 3. Implementación por capas

#### 3.1. Ruta

```javascript
// backend/src/routes/auth.routes.js
const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { authController } = require('../container');

const router = Router();

// El cierre de sesión lo realiza el cliente con supabase.auth.signOut(),
// que revoca el refresh token. No se expone un endpoint de logout.
router.get('/me', authMiddleware, asyncHandler(authController.me));

module.exports = router;
```

#### 3.2. Middleware

```javascript
// backend/src/middlewares/auth.middleware.js
const config = require('../config/environment');
const { createSupabaseClient } = require('../config/supabase');
const { createAuthService } = require('../container');
const ApiError = require('../utils/ApiError');

async function authMiddleware(req, _res, next) {
  try {
    const header = req.headers.authorization || '';

    if (!header.startsWith('Bearer ')) {
      throw ApiError.unauthorized('Se requiere un token Bearer.');
    }

    const token = header.slice('Bearer '.length).trim();

    if (!token) {
      throw ApiError.unauthorized('El token de acceso esta vacio.');
    }

    if (!config.supabase.isConfigured) {
      throw ApiError.serviceUnavailable('Supabase Auth no esta configurado en el servidor.');
    }

    const client = createSupabaseClient(token);
    const { data, error } = await client.auth.getUser(token);

    if (error || !data?.user) {
      throw ApiError.unauthorized('Token invalido o expirado.');
    }

    // El perfil y el rol se leen de la base de datos: es la fuente de verdad
    // y permite rechazar cuentas deshabilitadas en cada solicitud.
    req.user = await createAuthService(client).buildAuthenticatedUser(data.user);
    req.accessToken = token;

    return next();
  } catch (error) {
    return next(error);
  }
}

module.exports = authMiddleware;
```

#### 3.3. Servicio

```javascript
// backend/src/services/auth.service.js
const ApiError = require('../utils/ApiError');

const ROLE_ADMINISTRADOR = 'administrador';
const ROLE_ESTUDIANTE = 'estudiante';
const VALID_ROLES = new Set([ROLE_ADMINISTRADOR, ROLE_ESTUDIANTE]);
const ACTIVE_STATE = 'activo';

class AuthService {
  constructor({ usuarioRepository }) {
    this.usuarioRepository = usuarioRepository;
  }

  async buildAuthenticatedUser(user) {
    if (!user?.id) {
      throw ApiError.unauthorized('El token no contiene un usuario valido.');
    }

    const profile = await this.usuarioRepository.findById(user.id);

    if (!profile) {
      throw ApiError.forbidden(
        'La cuenta no tiene un perfil asociado. Contacte al administrador.',
      );
    }

    if (profile.estado !== ACTIVE_STATE) {
      throw ApiError.forbidden('La cuenta esta deshabilitada. Contacte al administrador.');
    }

    const roles = await this.resolveRoles(user.id);

    return {
      id: profile.id,
      email: user.email ?? profile.correo,
      nombre: profile.nombre,
      apellido: profile.apellido,
      correo: profile.correo,
      estado: profile.estado,
      role: roles.includes(ROLE_ADMINISTRADOR) ? ROLE_ADMINISTRADOR : roles[0],
      roles,
    };
  }

  async resolveRoles(userId) {
    const roleNames = await this.usuarioRepository.findRoleNames(userId);
    const validRoles = [...new Set(roleNames.filter((name) => VALID_ROLES.has(name)))];

    return validRoles.length > 0 ? validRoles : [ROLE_ESTUDIANTE];
  }
}

module.exports = AuthService;
```

#### 3.4. Repositorio

```javascript
// backend/src/repositories/usuario.repository.js
class UsuarioRepository {
  constructor({ supabase }) {
    this.supabase = supabase;
  }

  async findById(userId) {
    const { data, error } = await this.requireClient()
      .from('perfiles')
      .select('id, auth_user_id, nombre, apellido, correo, estado')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  }

  async findRoleNames(userId) {
    const { data, error } = await this.requireClient()
      .from('usuario_roles')
      .select('roles ( nombre )')
      .eq('usuario_id', userId);

    if (error) {
      throw error;
    }

    return (data ?? [])
      .map((row) => row.roles?.nombre)
      .filter((nombre) => typeof nombre === 'string');
  }

  requireClient() {
    if (!this.supabase) {
      throw new Error('Supabase no esta configurado en el servidor.');
    }

    return this.supabase;
  }
}

module.exports = UsuarioRepository;
```

#### 3.5. Controlador

```javascript
// backend/src/controllers/auth.controller.js
// El usuario lo resuelve authMiddleware; aquí solo se responde.
class AuthController {
  me = (req, res) => {
    res.json({ success: true, data: req.user });
  };
}

module.exports = AuthController;
```

#### 3.6. Composición de dependencias

```javascript
// backend/src/container.js
const UsuarioRepository = require('./repositories/usuario.repository');
const AuthService = require('./services/auth.service');

/**
 * Crea el servicio de autenticación con el cliente del usuario autenticado.
 * Así RLS se aplica en la lectura del perfil y no se necesita service_role.
 */
function createAuthService(supabaseClient) {
  const usuarioRepository = new UsuarioRepository({ supabase: supabaseClient });
  return new AuthService({ usuarioRepository });
}

module.exports = {
  createAuthService,
  authController: new AuthController(),
};
```

### 4. Pruebas de HU01

| Archivo | Qué valida | Casos |
|---|---|---|
| `tests/auth.service.test.js` | Perfil activo, prioridad de rol, cuenta inactiva, perfil inexistente, roles vacíos y roles desconocidos. | 6 |
| `tests/auth.middleware.test.js` | Rechazo sin token `Bearer` y respuesta `503` cuando Supabase no está configurado. | 2 |
| `tests/auth.routes.test.js` | `GET /api/auth/me` devuelve el perfil y el rol resueltos por el middleware. | 1 |

```javascript
// Fragmento de tests/auth.service.test.js
it('rechaza una cuenta inactiva sin consultar sus roles', async () => {
  const { service, usuarioRepository } = buildService({
    profile: { ...PROFILE, estado: 'inactivo' },
  });

  await expect(service.buildAuthenticatedUser(USER)).rejects.toMatchObject({
    statusCode: 403,
    message: expect.stringContaining('deshabilitada'),
  });
  expect(usuarioRepository.findRoleNames).not.toHaveBeenCalled();
});
```

### 5. Archivos y commit de HU01

```text
backend/
├── src/
│   ├── config/environment.js
│   ├── config/supabase.js
│   ├── container.js
│   ├── controllers/auth.controller.js
│   ├── middlewares/auth.middleware.js
│   ├── repositories/usuario.repository.js
│   ├── routes/auth.routes.js
│   └── services/auth.service.js
└── tests/
    ├── auth.middleware.test.js
    ├── auth.routes.test.js
    └── auth.service.test.js

supabase/migrations/0001_hu01_auth.sql
```

```text
feat(auth): implementar inicio de sesion de HU01

- Validar el JWT de Supabase Auth en authMiddleware
- Resolver perfil, estado y rol desde PostgreSQL
- Exponer GET /api/auth/me
- Agregar migración de perfiles, roles, trigger y RLS
- Cubrir el servicio, el middleware y la ruta con pruebas
```

---

## 👥 HU02: Administración de usuarios y roles

### 1. Endpoints implementados

Todas las rutas requieren `Authorization: Bearer <access_token>` y rol `administrador`.

| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/usuarios` | Lista usuarios con filtros, paginación y estadísticas. |
| `GET` | `/api/usuarios/buscar?termino=<texto>&limit=<n>` | Búsqueda rápida por nombre, apellido o correo. |
| `GET` | `/api/usuarios/roles` | Devuelve el catálogo de roles disponibles. |
| `GET` | `/api/usuarios/:id` | Devuelve el detalle de un usuario con sus roles. |
| `PATCH` | `/api/usuarios/:id/roles` | Actualiza los roles del usuario. |
| `PATCH` | `/api/usuarios/:id/estado` | Activa o desactiva al usuario. |

**Filtros de `GET /api/usuarios`**

| Parámetro | Tipo | Valores |
|---|---|---|
| `query` | texto | Busca en nombre, apellido y correo. |
| `estado` | enum | `activo`, `inactivo`. |
| `rol` | enum | `administrador`, `estudiante`. |
| `limit` | entero | `1–100`, por defecto `50`. |
| `offset` | entero | `>= 0`, por defecto `0`. |

### 2. Formato de respuesta

**Listado**

```json
{
  "success": true,
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "nombre": "Juan",
      "apellido": "Perez",
      "correo": "juan.perez@email.com",
      "carrera": "Ingenieria de Software",
      "estado": "activo",
      "fecha_creacion": "2024-01-15T10:30:00Z",
      "roles": ["estudiante"]
    }
  ],
  "meta": {
    "paginacion": { "limit": 20, "offset": 0, "total": 150 },
    "estadisticas": {
      "total": 150,
      "activos": 120,
      "inactivos": 30,
      "administradores": 5,
      "estudiantes": 145
    }
  }
}
```

**Detalle**

```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "nombre": "Juan",
    "apellido": "Perez",
    "correo": "juan.perez@email.com",
    "carrera": "Ingenieria de Software",
    "estado": "activo",
    "fecha_creacion": "2024-01-15T10:30:00Z",
    "roles_detalle": [
      {
        "id": 2,
        "nombre": "estudiante",
        "descripcion": "Acceso a su espacio academico personal."
      }
    ]
  }
}
```

**Actualización de roles**

```json
{
  "success": true,
  "data": {
    "usuarioId": "550e8400-e29b-41d4-a716-446655440000",
    "roles": ["administrador"],
    "mensaje": "Roles actualizados exitosamente"
  },
  "meta": {
    "operacion": {
      "tipo": "ACTUALIZACION_ROLES",
      "administradorId": "admin-id-123",
      "usuarioId": "550e8400-e29b-41d4-a716-446655440000",
      "rolesAnteriores": ["estudiante"],
      "rolesNuevos": ["administrador"],
      "fecha": "2024-01-20T14:30:00Z"
    }
  }
}
```

**Actualización de estado**

```json
{
  "success": true,
  "data": {
    "usuarioId": "550e8400-e29b-41d4-a716-446655440000",
    "estado": "inactivo",
    "mensaje": "Usuario desactivado exitosamente"
  },
  "meta": {
    "operacion": {
      "tipo": "ACTUALIZACION_ESTADO",
      "administradorId": "admin-id-123",
      "usuarioId": "550e8400-e29b-41d4-a716-446655440000",
      "estadoAnterior": "activo",
      "estadoNuevo": "inactivo",
      "fecha": "2024-01-20T14:30:00Z"
    }
  }
}
```

### 3. Modelos de validación con Zod

```javascript
// backend/src/models/usuario.model.js
const { z } = require('zod');

const usuarioBusquedaSchema = z.object({
  query: z.string().min(1).max(100).optional(),
  estado: z.enum(['activo', 'inactivo']).optional(),
  rol: z.enum(['administrador', 'estudiante']).optional(),
  limit: z.number().int().positive().max(100).default(50),
  offset: z.number().int().nonnegative().default(0),
});

const usuarioActualizarRolesSchema = z.object({
  roles: z
    .array(z.enum(['administrador', 'estudiante']))
    .min(1)
    .max(5)
    .refine(
      (roles) => !roles.includes('administrador') || roles.length === 1,
      {
        message:
          'Un usuario no puede tener multiples roles de administrador simultaneamente',
      },
    ),
});

const usuarioActualizarEstadoSchema = z.object({
  estado: z.enum(['activo', 'inactivo']),
});

const usuarioIdParamSchema = z.object({
  id: z.string().uuid(),
});

module.exports = {
  usuarioListadoSchema,
  usuarioDetalleSchema,
  usuarioBusquedaSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema,
};
```

> Zod valida la **forma** de la entrada. Las reglas que dependen de la base de datos (existencia del usuario, propiedad, último administrador) se validan en el servicio.

### 4. Rutas y middlewares

```javascript
// backend/src/routes/usuario.routes.js
const { Router } = require('express');
const authMiddleware = require('../middlewares/auth.middleware');
const adminMiddleware = require('../middlewares/admin.middleware');
const noSelfModificationMiddleware = require('../middlewares/no-self-modification.middleware');
const validationMiddleware = require('../middlewares/validation.middleware');
const asyncHandler = require('../utils/asyncHandler');
const { createUsuarioAdminService } = require('../container');

const {
  usuarioBusquedaSchema,
  usuarioActualizarRolesSchema,
  usuarioActualizarEstadoSchema,
  usuarioIdParamSchema,
} = require('../models/usuario.model');

const router = Router();

// Todas las rutas requieren autenticación y rol administrador.
router.use(authMiddleware, adminMiddleware);

// Inyecta el servicio con el ID del administrador que realiza la operación.
router.use((req, _res, next) => {
  try {
    req.usuarioAdminService = createUsuarioAdminService(req.user.id);
    next();
  } catch (error) {
    next(error);
  }
});

router.get(
  '/',
  validationMiddleware({ schema: usuarioBusquedaSchema, source: 'query' }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.listarUsuarios(req, res);
  }),
);

router.get(
  '/buscar',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.buscarUsuarios(req, res);
  }),
);

router.get(
  '/roles',
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.obtenerRolesDisponibles(req, res);
  }),
);

router.get(
  '/:id',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.obtenerUsuario(req, res);
  }),
);

router.patch(
  '/:id/roles',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  validationMiddleware({ schema: usuarioActualizarRolesSchema, source: 'body' }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.actualizarRolesUsuario(req, res);
  }),
);

router.patch(
  '/:id/estado',
  validationMiddleware({ schema: usuarioIdParamSchema, source: 'params' }),
  validationMiddleware({ schema: usuarioActualizarEstadoSchema, source: 'body' }),
  noSelfModificationMiddleware,
  asyncHandler(async (req, res) => {
    const controller = new (require('../controllers/usuario-admin.controller'))(
      req.usuarioAdminService,
    );
    await controller.actualizarEstadoUsuario(req, res);
  }),
);

module.exports = router;
```

**Middleware de rol**

```javascript
// backend/src/middlewares/admin.middleware.js
function adminMiddleware(req, _res, next) {
  try {
    if (!req.user) {
      throw ApiError.unauthorized('Usuario no autenticado');
    }

    if (req.user.role !== 'administrador') {
      throw ApiError.forbidden('Acceso denegado. Se requiere rol de administrador');
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
```

**Middleware de auto-modificación**

```javascript
// backend/src/middlewares/no-self-modification.middleware.js
function noSelfModificationMiddleware(req, _res, next) {
  try {
    const usuarioActualId = req.user?.id;
    const usuarioModificadoId = req.params?.id;

    if (!usuarioActualId || !usuarioModificadoId) {
      return next();
    }

    if (usuarioActualId === usuarioModificadoId) {
      throw ApiError.forbidden('No puedes modificar tus propios privilegios');
    }

    return next();
  } catch (error) {
    return next(error);
  }
}
```

> **Observación sobre la validación (HU02):** las rutas llaman a `validationMiddleware({ schema, source })`, pero el middleware real (`backend/src/middlewares/validation.middleware.js`) tiene la firma `validate(schemas)` y espera un objeto indexado por fuente, por ejemplo `validationMiddleware({ query: usuarioBusquedaSchema })` o `validationMiddleware({ params: usuarioIdParamSchema })`. Con la llamada actual el middleware no valida nada: intenta hacer `safeParse` sobre `req.schema` y luego trata el string `'query'`/`'params'` como esquema, lo que termina en un `TypeError` y un `500`. Además, `usuarioBusquedaSchema` declara `limit` y `offset` con `z.number()`, pero los query params llegan como texto; para validarlos correctamente deberían usar `z.coerce.number()`. Hoy los controladores vuelven a parsear `req.query`/`req.params`/`req.body` con Zod, por lo que la validación efectiva ocurre en el controlador y no en el middleware. Corregir la firma de las rutas es un pendiente técnico de HU02 y no afecta a HU01.

### 5. Controlador

```javascript
// backend/src/controllers/usuario-admin.controller.js
class UsuarioAdminController {
  constructor(service) {
    this.service = service;
  }

  listarUsuarios = async (req, res, next) => {
    try {
      const filtros = usuarioBusquedaSchema.parse(req.query);
      const resultado = await this.service.listarUsuarios(filtros);

      res.json({
        success: true,
        data: resultado.usuarios,
        meta: {
          paginacion: resultado.paginacion,
          estadisticas: resultado.estadisticas,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerUsuario = async (req, res, next) => {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const usuario = await this.service.obtenerUsuario(id);

      res.json({ success: true, data: usuario });
    } catch (error) {
      next(error);
    }
  };

  actualizarRolesUsuario = async (req, res, next) => {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const { roles } = usuarioActualizarRolesSchema.parse(req.body);
      const resultado = await this.service.actualizarRolesUsuario(id, roles);

      res.json({
        success: true,
        data: {
          usuarioId: resultado.usuarioId,
          roles: resultado.roles,
          mensaje: resultado.mensaje,
        },
        meta: { operacion: resultado.operacion },
      });
    } catch (error) {
      next(error);
    }
  };

  actualizarEstadoUsuario = async (req, res, next) => {
    try {
      const { id } = usuarioIdParamSchema.parse(req.params);
      const { estado } = usuarioActualizarEstadoSchema.parse(req.body);
      const resultado = await this.service.actualizarEstadoUsuario(id, estado);

      res.json({
        success: true,
        data: {
          usuarioId: resultado.usuarioId,
          estado: resultado.estado,
          mensaje: resultado.mensaje,
        },
        meta: { operacion: resultado.operacion },
      });
    } catch (error) {
      next(error);
    }
  };

  obtenerRolesDisponibles = async (_req, res, next) => {
    try {
      const roles = await this.service.obtenerRolesDisponibles();
      res.json({ success: true, data: roles });
    } catch (error) {
      next(error);
    }
  };

  buscarUsuarios = async (req, res, next) => {
    try {
      const termino = String(req.query.termino ?? '').trim();

      if (termino.length < 2) {
        return res.json({
          success: true,
          data: [],
          meta: { mensaje: 'Termino de busqueda muy corto' },
        });
      }

      const usuarios = await this.service.buscarUsuarios(termino, 20);
      return res.json({ success: true, data: usuarios });
    } catch (error) {
      return next(error);
    }
  };
}
```

### 6. Servicio

```javascript
// backend/src/services/usuario-admin.service.js
class UsuarioAdminService {
  constructor(repository, usuarioActualId) {
    this.repository = repository;
    this.usuarioActualId = usuarioActualId;
  }

  async listarUsuarios(filtros = {}) {
    const usuarios = await this.repository.listarUsuarios(filtros);
    const estadisticas = await this.repository.obtenerEstadisticas();

    return {
      usuarios,
      paginacion: {
        limit: filtros.limit || 50,
        offset: filtros.offset || 0,
        total: parseInt(estadisticas.total_usuarios || 0),
      },
      estadisticas: {
        total: parseInt(estadisticas.total_usuarios || 0),
        activos: parseInt(estadisticas.usuarios_activos || 0),
        inactivos: parseInt(estadisticas.usuarios_inactivos || 0),
        administradores: parseInt(estadisticas.total_administradores || 0),
        estudiantes: parseInt(estadisticas.total_estudiantes || 0),
      },
    };
  }

  async obtenerUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);

    if (!usuario) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    return usuario;
  }

  async actualizarRolesUsuario(usuarioId, roles) {
    // 1. Un administrador no puede modificar sus propios privilegios.
    if (usuarioId === this.usuarioActualId) {
      throw ApiError.forbidden('No puedes modificar tus propios privilegios');
    }

    // 2. El usuario debe existir.
    const usuarioExiste = await this.repository.existeUsuario(usuarioId);
    if (!usuarioExiste) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    // 3. No se puede remover al último administrador.
    if (!roles.includes('administrador')) {
      const estadisticas = await this.repository.obtenerEstadisticas();
      const totalAdministradores = parseInt(estadisticas.total_administradores || 0);
      const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
      const esAdministrador = usuario.roles_detalle.some(
        (rol) => rol.nombre === 'administrador',
      );

      if (esAdministrador && totalAdministradores <= 1) {
        throw ApiError.forbidden('No se puede remover al unico administrador del sistema');
      }
    }

    try {
      await this.repository.actualizarRolesUsuario(usuarioId, roles);

      const operacion = {
        tipo: 'ACTUALIZACION_ROLES',
        administradorId: this.usuarioActualId,
        usuarioId,
        rolesAnteriores: await this.obtenerRolesUsuario(usuarioId),
        rolesNuevos: roles,
        fecha: new Date().toISOString(),
      };

      return { mensaje: 'Roles actualizados exitosamente', usuarioId, roles, operacion };
    } catch (error) {
      throw new ApiError(500, `Error al actualizar roles: ${error.message}`);
    }
  }

  async actualizarEstadoUsuario(usuarioId, estado) {
    // 1. Un administrador no puede modificar su propio estado.
    if (usuarioId === this.usuarioActualId) {
      throw ApiError.forbidden('No puedes modificar tu propio estado');
    }

    // 2. El usuario debe existir.
    const usuarioExiste = await this.repository.existeUsuario(usuarioId);
    if (!usuarioExiste) {
      throw ApiError.notFound('Usuario no encontrado');
    }

    // 3. No se puede desactivar al último administrador.
    if (estado === 'inactivo') {
      const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
      const esAdministrador = usuario.roles_detalle.some(
        (rol) => rol.nombre === 'administrador',
      );

      if (esAdministrador) {
        const estadisticas = await this.repository.obtenerEstadisticas();
        const totalAdministradores = parseInt(estadisticas.total_administradores || 0);

        if (totalAdministradores <= 1) {
          throw ApiError.forbidden('No se puede desactivar al unico administrador del sistema');
        }
      }
    }

    try {
      await this.repository.actualizarEstadoUsuario(usuarioId, estado);

      const operacion = {
        tipo: 'ACTUALIZACION_ESTADO',
        administradorId: this.usuarioActualId,
        usuarioId,
        estadoAnterior: await this.obtenerEstadoUsuario(usuarioId),
        estadoNuevo: estado,
        fecha: new Date().toISOString(),
      };

      return {
        mensaje: `Usuario ${estado === 'activo' ? 'activado' : 'desactivado'} exitosamente`,
        usuarioId,
        estado,
        operacion,
      };
    } catch (error) {
      throw new ApiError(500, `Error al actualizar estado: ${error.message}`);
    }
  }

  async obtenerRolesUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
    return usuario ? usuario.roles_detalle.map((rol) => rol.nombre) : [];
  }

  async obtenerEstadoUsuario(usuarioId) {
    const usuario = await this.repository.obtenerUsuarioPorId(usuarioId);
    return usuario ? usuario.estado : null;
  }
}
```

> **Observación de auditoría:** en el código actual `rolesAnteriores` y `estadoAnterior` se consultan **después** de aplicar el cambio, por lo que la operación devuelta repite el valor nuevo. Para que la auditoría sea correcta, esas dos consultas deben moverse antes de `repository.actualizarRolesUsuario` / `repository.actualizarEstadoUsuario`.

### 7. Repositorio

El repositorio administrativo concentra las consultas SQL y usa `service_role`, por lo que **no** depende de RLS para leer todos los perfiles.

| Método | Responsabilidad |
|---|---|
| `listarUsuarios(filtros)` | Consulta paginada con `ILIKE` sobre nombre, apellido y correo; agrega roles con `ARRAY_AGG`. |
| `obtenerUsuarioPorId(id)` | Devuelve el perfil y sus roles con `JSON_AGG`. |
| `obtenerRolesDisponibles()` | Lee el catálogo `roles`. |
| `actualizarRolesUsuario(id, roles)` | Elimina los roles actuales e inserta los nuevos dentro de una transacción (`BEGIN` / `COMMIT` / `ROLLBACK`). |
| `actualizarEstadoUsuario(id, estado)` | Actualiza `perfiles.estado`. |
| `existeUsuario(id)` | Verifica la existencia del perfil. |
| `obtenerEstadisticas()` | Calcula totales, activos, inactivos, administradores y estudiantes. |

**Consulta principal del listado**

```sql
SELECT
  p.id,
  p.nombre,
  p.apellido,
  p.correo,
  p.carrera,
  p.estado,
  p.fecha_creacion,
  ARRAY_AGG(r.nombre ORDER BY r.nombre) AS roles
FROM public.perfiles p
LEFT JOIN public.usuario_roles ur ON p.id = ur.usuario_id
LEFT JOIN public.roles r ON ur.rol_id = r.id
WHERE (p.nombre ILIKE $1 OR p.apellido ILIKE $1 OR p.correo ILIKE $1)
GROUP BY p.id, p.nombre, p.apellido, p.correo, p.carrera, p.estado, p.fecha_creacion
ORDER BY p.fecha_creacion DESC
LIMIT $2 OFFSET $3;
```

**Transacción de actualización de roles**

```sql
BEGIN;

DELETE FROM public.usuario_roles WHERE usuario_id = $1;

INSERT INTO public.usuario_roles (usuario_id, rol_id) VALUES ($1, $2);
-- Se repite por cada rol solicitado.

COMMIT;
```

> **Observación técnica:** el repositorio usa la interfaz `db.query(sql, params)` (estilo `pg`). El cliente `@supabase/supabase-js` no expone `query`, solo `from` y `rpc`; por lo tanto, para ejecutar HU02 contra Supabase se debe inyectar un cliente PostgreSQL (`pg.Pool`) o migrar el repositorio al query builder/RPC. Esta observación no afecta a HU01, que sí usa el cliente de Supabase correctamente.

### 8. Manejo de errores

```javascript
// backend/src/utils/ApiError.js
class ApiError extends Error {
  constructor(statusCode, message, details = undefined) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Solicitud invalida', details) {
    return new ApiError(400, message, details);
  }

  static unauthorized(message = 'No autenticado') {
    return new ApiError(401, message);
  }

  static forbidden(message = 'No autorizado') {
    return new ApiError(403, message);
  }

  static notFound(message = 'Recurso no encontrado') {
    return new ApiError(404, message);
  }

  static conflict(message = 'Conflicto con el estado actual del recurso') {
    return new ApiError(409, message);
  }

  static serviceUnavailable(message = 'Servicio no disponible') {
    return new ApiError(503, message);
  }
}
```

El middleware central responde siempre con el sobre estándar:

```json
{
  "success": false,
  "error": {
    "message": "Usuario no encontrado",
    "details": { "source": "params", "issues": [] }
  }
}
```

**Reglas**

- Los errores esperados se modelan con `ApiError`.
- Los `ZodError` se traducen a `400` con la lista de campos inválidos.
- Los errores `5xx` se registran en el servidor; nunca se expone `stack` en producción.
- No se devuelven credenciales, tokens ni rutas internas.

### 9. Pruebas de HU02

| Archivo | Qué valida | Casos |
|---|---|---|
| `tests/usuario-admin.service.test.js` | Listado y estadísticas, usuario inexistente, roles disponibles, auto-modificación, último administrador, actualización de roles y estado, búsqueda. | 15 |

```javascript
// Fragmento de tests/usuario-admin.service.test.js
it('should prevent self-modification', async () => {
  await expect(
    service.actualizarRolesUsuario(usuarioActualId, ['administrador']),
  ).rejects.toThrow('No puedes modificar tus propios privilegios');
});
```

### 10. Archivos y commit de HU02

```text
backend/
├── src/
│   ├── container.js
│   ├── controllers/usuario-admin.controller.js
│   ├── middlewares/
│   │   ├── admin.middleware.js
│   │   └── no-self-modification.middleware.js
│   ├── models/usuario.model.js
│   ├── repositories/usuario-admin.repository.js
│   ├── routes/usuario.routes.js
│   └── services/usuario-admin.service.js
└── tests/usuario-admin.service.test.js
```

```text
feat(admin): administrar usuarios y roles

- Implementar listado, detalle, búsqueda y catálogo de roles
- Implementar actualización de roles y estados
- Agregar validaciones Zod y middlewares de seguridad
- Proteger contra auto-modificación y pérdida del último administrador
- Cubrir el servicio administrativo con pruebas unitarias
```

---

## ✅ Validación y evidencias

### Lint

```bash
cd backend
npm run lint
```

Resultado: **sin errores** (`eslint .` finaliza con código `0`).

### Pruebas

```bash
cd backend
npm test
```

Resultado real de la suite completa:

```text
Test Suites: 5 passed, 5 total
Tests:       26 passed, 26 total
Snapshots:   0 total
Time:        10.306 s
```

**Distribución de las 26 pruebas**

| Suite | Pruebas |
|---|---:|
| `auth.service.test.js` (HU01) | 6 |
| `auth.middleware.test.js` (HU01) | 2 |
| `auth.routes.test.js` (HU01) | 1 |
| `usuario-admin.service.test.js` (HU02) | 15 |
| `health.test.js` | 2 |
| **Total** | **26** |

### Migración aplicada

```text
supabase/migrations/0001_hu01_auth.sql
```

El script es idempotente e incluye tablas, catálogo de roles, trigger de registro, relleno de usuarios existentes y políticas RLS.

---

## 📋 Conclusiones

### Logros

1. **Autenticación centralizada y sin estado**
   - `authMiddleware` valida el JWT de Supabase en cada solicitud.
   - El perfil y el rol se resuelven desde PostgreSQL, no desde los metadatos del token.
   - Las cuentas inactivas pierden el acceso de inmediato.

2. **Separación por capas**
   - HU01 y HU02 respetan `routes → controllers → services → repositories`.
   - Los controladores solo traducen HTTP.
   - Las reglas de negocio viven en los servicios.

3. **Seguridad en profundidad**
   - RLS de solo lectura para el usuario autenticado.
   - Middlewares de autenticación, rol y auto-modificación.
   - Validación de entradas con Zod.
   - Protección del último administrador.

4. **Pruebas automatizadas**
   - 26 pruebas unitarias y de integración con Supertest.
   - Mock de Supabase y de repositorios; sin llamadas reales a servicios externos.

### Limitaciones y pendientes

- El registro y el login desde backend no están implementados: el cliente usa Supabase Auth directamente.
- No existe endpoint de logout; el cierre de sesión se realiza con `supabase.auth.signOut()` y el backend rechaza el token revocado.
- HU02 requiere `SUPABASE_SERVICE_ROLE_KEY` para operar con privilegios administrativos.
- El repositorio administrativo usa `db.query`; debe ejecutarse con un cliente PostgreSQL (`pg.Pool`) o migrarse a `from`/`rpc` de Supabase para funcionar contra el cliente actual.
- Las rutas de HU02 invocan `validationMiddleware({ schema, source })`, pero el middleware espera `{ query | params | body: esquema }`; la validación efectiva hoy ocurre en el controlador. Además, `limit` y `offset` usan `z.number()` en lugar de `z.coerce.number()` para valores de query string.
- La auditoría de operaciones se devuelve en la respuesta, pero todavía no se persiste en una tabla de logs y `rolesAnteriores`/`estadoAnterior` se leen después de aplicar el cambio.
- Las pruebas son unitarias con dobles; falta una prueba de integración contra un proyecto real de Supabase.
- El frontend queda fuera del alcance de este documento.

### Estado

| Elemento | Estado |
|---|---|
| HU01 backend | ✅ Implementado y probado |
| HU02 backend | ✅ Implementado y probado a nivel de servicio |
| Migración de base de datos | ✅ Disponible e idempotente |
| Lint | ✅ Sin errores |
| Pruebas backend | ✅ 26/26 |
