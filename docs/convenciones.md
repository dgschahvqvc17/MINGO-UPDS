# Convenciones de desarrollo de MINGO

**Versión:** 1.0  
**Aplica a:** backend, frontend, base de datos, infraestructura y documentación.  
**Objetivo:** código consistente, revisable y mantenible.

## 1. Idioma

| Elemento | Idioma |
|---|---|
| Código (variables, funciones, clases) | inglés |
| Nombres de tablas y columnas | español, `snake_case` |
| Endpoints de la API | español, sustantivos en plural |
| Mensajes al usuario | español |
| Comentarios y documentación | español |
| Commits | español o inglés, consistente dentro del PR |
| Ramas | inglés, `kebab-case` |

Regla: un identificador no mezcla idiomas (`getUsuarioById` está prohibido; usar `getUserById`).

## 2. Estructura del repositorio

```text
MINGO/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   ├── models/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── repositories/
│   │   ├── middlewares/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   ├── tests/
│   └── package.json
├── frontend/
│   └── src/app/
│       ├── core/
│       ├── shared/
│       ├── features/
│       └── layout/
├── docs/
└── README.md
```

## 3. Backend

### 3.1. Estilo general

- CommonJS (`require` / `module.exports`).
- `async/await`, nunca callbacks anidados.
- Funciones pequeñas con una sola responsabilidad.
- Nombres descriptivos; evitar abreviaturas ambiguas.
- Sin variables globales mutables.
- Sin lógica de negocio en rutas ni controladores.
- Sin SQL en controladores.
- Sin `console.log` en producción; usar un logger.
- Sin `any` implícito en TypeScript; en JavaScript, validar con Zod.

### 3.2. Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Archivos | `kebab-case` con sufijo de capa | `materia.controller.js` |
| Variables y funciones | `camelCase` | `obtenerMateriasDelUsuario` |
| Clases y errores | `PascalCase` | `ApiError` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_UPLOAD_BYTES` |
| Booleanos | prefijo `is`, `has`, `can` | `isConfigured` |
| Colecciones | plural | `materias`, `tareas` |

### 3.3. Capas

| Capa | Puede | No puede |
|---|---|---|
| Route | Definir método, ruta y middlewares. | Consultar datos ni contener reglas. |
| Controller | Leer `req`, llamar al servicio, responder. | Consultar Supabase ni calcular reglas complejas. |
| Service | Reglas de negocio, IA, AWS, transacciones. | Conocer `req`/`res` ni SQL. |
| Repository | Consultas a Supabase. | Responder HTTP ni aplicar reglas de negocio. |
| Middleware | Auth, roles, validación, errores. | Lógica de módulos. |

### 3.4. Manejo de errores

```js
const { ApiError } = require('../utils/ApiError');

if (!materia) {
  throw new ApiError(404, 'NOT_FOUND', 'Materia no encontrada.');
}
```

- Usar `asyncHandler` para envolver controladores asíncronos.
- Lanzar `ApiError` con código estable.
- No exponer `error.stack` ni mensajes internos al cliente.
- El middleware de errores registra con identificador de correlación.

### 3.5. Validación

- Un esquema Zod por endpoint, en `models/` o junto al módulo.
- Validar `body`, `query` y `params`.
- Mensajes de error en español.
- Reutilizar esquemas comunes (`uuidSchema`, `idSchema`, `paginationSchema`). `uuidSchema` se usa para `usuario_id`; `idSchema` valida enteros positivos para los IDs de dominio.

```js
const crearMateriaSchema = z.object({
  nombre: z.string().trim().min(2).max(120),
  codigo: z.string().trim().max(30).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});
```

### 3.6. Respuestas

- Usar siempre `{ success: true, data }` o `{ success: false, error }`.
- Los endpoints de lista incluyen `meta` de paginación.
- No devolver campos internos (`created_at` puede exponerse; `service_role` nunca).

### 3.7. Pruebas

- Archivo `*.test.js` junto al módulo o en `tests/`.
- Nombre del test en español, descriptivo.
- Un `describe` por módulo y un `it` por comportamiento.
- Mocks de Supabase y AWS en pruebas unitarias.
- Supertest para endpoints.
- Sin pruebas que dependan de datos reales de producción.

## 4. Frontend

### 4.1. Estilo Angular

- Angular 21 con componentes standalone.
- `ChangeDetectionStrategy.OnPush` en componentes de presentación.
- `inject()` en lugar de inyección por constructor cuando sea posible.
- Signals para estado local; RxJS para flujos asíncronos.
- `async` pipe o `toSignal` para suscripciones.
- Desuscribirse correctamente o usar `takeUntilDestroyed`.
- Sin lógica de negocio compleja en componentes; usar servicios.

### 4.2. Nombres

| Elemento | Convención | Ejemplo |
|---|---|---|
| Componentes | `PascalCase` | `MateriaDetalleComponent` |
| Archivos | `kebab-case` | `materia-detalle.component.ts` |
| Servicios | `PascalCase` + `Service` | `MateriaService` |
| Guards | `PascalCase` + `Guard` | `authGuard` |
| Interfaces | `PascalCase` sin prefijo `I` | `Materia` |
| Rutas | `kebab-case` | `/centro-estudio` |

### 4.3. Organización

```text
features/materias/
├── materias.routes.ts
├── pages/
│   ├── lista/
│   └── detalle/
├── components/
├── services/
└── models/
```

- `core/`: servicios singleton, guards, interceptores, modelos globales.
- `shared/`: componentes, pipes y directivas reutilizables sin dependencias de features.
- `features/`: módulos funcionales con rutas lazy.
- Un componente por archivo.
- Sin imports circulares entre features.

### 4.4. Plantillas

- Usar Bootstrap 5 antes de crear CSS propio.
- Evitar estilos inline.
- Accesibilidad: `label` asociado, `aria-*` cuando aplique, contraste suficiente, navegación por teclado.
- No usar `innerHTML` con contenido de IA.
- Mostrar estados de carga, vacío y error en toda lista.

### 4.5. Servicios HTTP

- Centralizar la URL base en el entorno.
- Interceptor para el token.
- Interceptor para errores y `401`.
- Tipar las respuestas.
- No duplicar llamadas; cachear cuando corresponda.

```ts
getMaterias(): Observable<Materia[]> {
  return this.api.get<Materia[]>('/materias');
}
```

## 5. Base de datos

- Tablas y columnas en `snake_case`.
- Claves primarias: `UUID` en `perfiles` (igual a `auth.users.id`) y `SERIAL` entero en las tablas de dominio.
- Las columnas `usuario_id` son `UUID`; las demás claves foráneas son enteras.
- Fechas `timestamptz`.
- Estados con `check`.
- Índices en claves foráneas y columnas de filtro.
- RLS en toda tabla.
- Migraciones versionadas con Supabase CLI.
- Nombres de migración descriptivos: `20261107_crear_tablas_academicas.sql`.

## 6. Git y ramas

### 6.1. Ramas

| Tipo | Formato | Ejemplo |
|---|---|---|
| Funcionalidad | `feature/<hu>-<descripcion>` | `feature/hu03-materias` |
| Corrección | `fix/<descripcion>` | `fix/validacion-fecha-tarea` |
| Documentación | `docs/<descripcion>` | `docs/reglas-aws` |
| Infraestructura | `chore/<descripcion>` | `chore/config-sam` |
| Refactor | `refactor/<descripcion>` | `refactor/servicio-rag` |

Reglas:

- `main` siempre desplegable.
- Una rama por historia o corrección.
- Ramas cortas (máximo 1 semana).
- Rebase o merge desde `main` antes de abrir el PR.
- No hacer push directo a `main` cuando haya más de una persona.

### 6.2. Commits

Formato Conventional Commits:

```text
<tipo>(<alcance>): <descripcion>
```

| Tipo | Uso |
|---|---|
| `feat` | Nueva funcionalidad. |
| `fix` | Corrección de error. |
| `docs` | Documentación. |
| `style` | Formato sin cambio de lógica. |
| `refactor` | Cambio interno sin alterar comportamiento. |
| `test` | Pruebas. |
| `chore` | Tareas de mantenimiento. |
| `perf` | Mejora de rendimiento. |
| `ci` | Cambios de integración continua. |

Ejemplos:

```text
feat(materias): agregar CRUD de materias
fix(tareas): validar fecha de entrega anterior a asignacion
docs(aws): documentar limites de lambda
test(rag): cubrir busqueda sin resultados
```

Reglas:

- Descripción en imperativo, minúscula, sin punto final.
- Máximo 72 caracteres en la primera línea.
- Un commit = un cambio lógico.
- No commitear archivos generados, `node_modules` ni `.env`.

## 7. Pull Requests

### 7.1. Contenido mínimo

- Título con el mismo formato del commit.
- Descripción: qué cambia, por qué, cómo probarlo.
- Referencia a la historia de usuario o issue.
- Capturas si hay cambios visuales.
- Checklist de pruebas.

### 7.2. Plantilla

```markdown
## Qué cambia
-

## Por qué
-

## Cómo probar
1.
2.

## Checklist
- [ ] Lint sin errores
- [ ] Pruebas aprobadas
- [ ] Documentación actualizada
- [ ] Sin secretos ni credenciales
- [ ] Sin recursos AWS fuera de la lista blanca
- [ ] RLS y permisos verificados
```

### 7.3. Revisión

- Al menos una aprobación para cambios normales.
- Dos aprobaciones para cambios de seguridad, base de datos o infraestructura.
- El autor no aprueba su propio PR.
- Resolver todos los comentarios antes de fusionar.
- No fusionar con pruebas rojas.

## 8. Calidad de código

### 8.1. Herramientas

| Ámbito | Herramienta |
|---|---|
| Backend lint | ESLint |
| Backend formato | Prettier |
| Backend pruebas | Jest + Supertest |
| Frontend lint | Angular ESLint |
| Frontend formato | Prettier |
| Frontend pruebas | Vitest / Karma según configuración de Angular |
| Base de datos | Supabase CLI |

### 8.2. Comandos obligatorios antes de un PR

```bash
# backend
cd backend
npm run lint
npm test

# frontend
cd frontend
npm run lint
npm run build
npm test -- --watch=false
```

## 9. Definition of Done

Una historia está terminada cuando:

- [ ] Cumple todos los requerimientos funcionales de la HU.
- [ ] El código sigue las capas y convenciones.
- [ ] Tiene validación Zod en el backend.
- [ ] Tiene manejo de estados de carga, vacío y error en el frontend.
- [ ] Tiene pruebas unitarias o de integración relevantes.
- [ ] Lint y build pasan sin errores.
- [ ] La documentación afectada está actualizada.
- [ ] No introduce secretos ni recursos AWS fuera de la lista blanca.
- [ ] RLS y control de acceso verificados.
- [ ] El PR fue revisado y aprobado.
- [ ] Se probó el flujo principal de principio a fin.

## 10. Documentación

- Todo cambio de arquitectura, endpoint, tabla o servicio AWS actualiza su MD en `docs/`.
- Los documentos no contienen credenciales ni datos personales.
- Los ejemplos deben ser ejecutables o claramente ilustrativos.
- Un documento nuevo se enlaza desde `docs/README.md`.
- Fechas y versiones al inicio del documento.

## 11. Manejo de dependencias

- No agregar una dependencia sin justificar el problema que resuelve.
- Preferir dependencias mantenidas y con licencia compatible.
- Revisar `npm audit --omit=dev` antes de fusionar.
- Fijar versiones compatibles; no usar rangos abiertos en producción.
- Evitar paquetes que dupliquen funcionalidad ya disponible.
- Las dependencias de desarrollo no van al paquete de Lambda.

## 12. Registro de decisiones

Las decisiones importantes se documentan en el MD correspondiente con:

```text
Fecha:
Decisión:
Contexto:
Alternativas consideradas:
Consecuencias:
Responsable:
```

Ejemplos: cambiar el proveedor de IA, cambiar el modelo de embeddings, agregar un servicio AWS, modificar la estrategia de almacenamiento.
