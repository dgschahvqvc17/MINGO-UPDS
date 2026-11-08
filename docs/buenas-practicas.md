# Buenas prácticas de código — Clean Code y SOLID

**Versión:** 1.0
**Fecha:** 2026-11-07
**Aplica a:** backend y frontend de MINGO
**Objetivo:** código legible, mantenible, testeable y seguro, con reglas concretas y ejemplos aplicables al proyecto.

> Este documento es la base común. Las reglas específicas de cada tecnología están en [buenas-practicas-backend.md](buenas-practicas-backend.md) y [buenas-practicas-frontend.md](buenas-practicas-frontend.md).

---

## 1. Principios generales

| Principio | Significado en MINGO |
|---|---|
| **KISS** | La solución más simple que cumple el requisito. Sin patrones innecesarios. |
| **DRY** | Una regla de negocio se escribe una vez. Duplicar lógica es deuda técnica. |
| **YAGNI** | No implementar funciones "por si acaso". Solo lo que la historia de usuario pide. |
| **Boy Scout** | Al tocar un archivo, dejarlo un poco mejor: nombre, duplicación, prueba faltante. |
| **Fail fast** | Validar temprano y fallar con un error claro, no continuar con datos inválidos. |
| **Least surprise** | El código hace lo que su nombre sugiere. Sin efectos secundarios ocultos. |
| **Separation of concerns** | Cada capa y cada módulo tiene una responsabilidad delimitada. |
| **Composition over inheritance** | Preferir composición y funciones puras antes que jerarquías profundas. |
| **Explicit over implicit** | Dependencias y efectos visibles. Sin magia ni estado global mutable. |

### Regla de legibilidad

El código se lee muchas más veces de las que se escribe. Si una persona del equipo necesita explicación para entender una función, la función debe reescribirse o documentarse.

---

## 2. Nombres

Un buen nombre elimina la necesidad de comentarios.

### 2.1. Reglas

- Nombres completos y pronunciables: `remainingAttempts`, no `remAtt`.
- Sin abreviaturas ambiguas: `user`, no `usr`; `document`, no `doc` salvo que `doc` sea el término del dominio.
- Sin nombres genéricos: `data`, `info`, `thing`, `temp`, `aux`, `handle`, `process`.
- Booleanos con prefijo `is`, `has`, `can`, `should`: `isProcessing`, `hasAccess`.
- Funciones con verbo: `getUserById`, `calculateScore`, `validateUpload`.
- Colecciones en plural: `documents`, `questions`.
- Constantes en `UPPER_SNAKE_CASE`: `MAX_UPLOAD_BYTES`.
- Clases y errores en `PascalCase`: `DocumentService`, `ApiError`.
- Sin notación húngara ni prefijos de tipo (`strName`, `objUser`).
- No mezclar idiomas en un mismo identificador (`getUsuarioById` está prohibido).

### 2.2. Ejemplos

```js
// Mal
const d = await repo.get(id);
if (d.st === 1) { ... }

// Bien
const document = await documentRepository.findById(documentId);
if (document.status === DOCUMENT_STATUS.PROCESSED) { ... }
```

```ts
// Mal
export class Mgr { lst: any[] = []; fn(x: any) { ... } }

// Bien
export class QuizService {
  private readonly questions: Question[] = [];
  addQuestion(question: Question): void { ... }
}
```

### 2.3. Nombres de dominio

Usar el vocabulario del producto y de la base de datos:

| Concepto | Nombre |
|---|---|
| Usuario autenticado | `userId` (UUID) |
| Materia | `subject` (entidad `materias`) |
| Tarea | `task` (entidad `tareas`) |
| Documento | `document` |
| Fragmento de documento | `chunk` |
| Conversación | `conversation` |
| Cuestionario | `quiz` |
| Pregunta | `question` |

No inventar sinónimos para la misma entidad dentro del mismo módulo.

---

## 3. Funciones

### 3.1. Reglas

- **Una responsabilidad.** Si el nombre necesita "y", son dos funciones.
- **Cortas.** Idealmente menos de 30 líneas; máximo razonable 50.
- **Pocos parámetros.** Máximo 3. Si hay más, usar un objeto con nombre.
- **Sin efectos secundarios ocultos.** Si modifica estado, el nombre lo dice (`save`, `update`, `delete`).
- **Un nivel de abstracción.** No mezclar HTTP, validación y SQL en la misma función.
- **Retorno temprano** para evitar anidamiento profundo.
- **Funciones puras** cuando sea posible: mismos argumentos, mismo resultado, sin estado externo.

### 3.2. Guard clauses

```js
// Mal
function calculateAverage(scores) {
  if (scores) {
    if (scores.length > 0) {
      let sum = 0;
      for (const score of scores) sum += score;
      return sum / scores.length;
    } else {
      return null;
    }
  } else {
    return null;
  }
}

// Bien
function calculateAverage(scores) {
  if (!Array.isArray(scores) || scores.length === 0) return null;

  const sum = scores.reduce((total, score) => total + score, 0);
  return sum / scores.length;
}
```

### 3.3. Objeto de opciones

```js
// Mal
function createTask(userId, subjectId, title, priority, dueDate, description) { ... }

// Bien
function createTask({ userId, subjectId, title, priority, dueDate, description }) { ... }
```

### 3.4. Booleanos como parámetro

Un booleano en la llamada no comunica intención.

```js
// Mal
sendNotification(user, true);

// Bien
sendNotification(user, { immediate: true });
```

---

## 4. Comentarios

- El código debe explicar **qué** hace. El comentario explica **por qué**.
- No comentar lo obvio: `// incrementa i` no aporta.
- No dejar código comentado. Se elimina; Git conserva el historial.
- No usar comentarios para compensar nombres malos.
- Documentar decisiones no evidentes, restricciones externas y workarounds con referencia.
- Los `TODO` deben incluir responsable o issue: `// TODO(HU12): cachear embeddings`.

```js
// Mal
// Obtiene el usuario
const user = await repository.findById(id);

// Bien
// El proveedor de IA limita a 20 fragmentos por solicitud; se recorta aquí
// para no gastar tokens en contexto que el modelo va a ignorar.
const contextChunks = chunks.slice(0, MAX_CONTEXT_CHUNKS);
```

---

## 5. Manejo de errores

### 5.1. Reglas

- **No silenciar errores.** Un `catch` vacío es un bug.
- **No usar errores para control de flujo normal.** Validar antes.
- **Errores con contexto.** Un mensaje debe permitir diagnosticar.
- **No exponer detalles internos al cliente.** Log interno, mensaje seguro externo.
- **Un solo formato de error en la API:** `{ success: false, error: { message, details? } }`.
- **Errores esperados vs inesperados:** los esperados se modelan (`ApiError`); los inesperados se registran y devuelven `500`.
- **Sin `throw` de strings.** Siempre `Error` o subclase.
- **No tragar errores en promesas.** `async/await` con `try/catch` o middleware central.

### 5.2. Ejemplo backend

```js
const ApiError = require('../utils/ApiError');

async function getDocumentForUser(documentId, userId) {
  const document = await documentRepository.findById(documentId);

  // Un recurso ajeno se trata como inexistente para no filtrar información.
  if (!document || document.usuario_id !== userId) {
    throw ApiError.notFound('Documento no encontrado.');
  }

  return document;
}
```

### 5.3. Ejemplo frontend

```ts
this.taskService.getTasks().subscribe({
  next: (tasks) => this.tasks.set(tasks),
  error: () => this.errorMessage.set('No se pudieron cargar las tareas.'),
});
```

Nunca mostrar el mensaje crudo del backend sin revisar que sea apto para el usuario.

---

## 6. SOLID

SOLID es una guía, no un fin. Aplicarlo donde reduce el acoplamiento; no crear abstracciones para un solo uso sin motivo.

### 6.1. S — Single Responsibility Principle

Una clase o módulo debe tener **una sola razón para cambiar**.

```js
// Mal: el controlador valida, consulta, calcula y responde.
router.post('/tasks', async (req, res) => {
  if (!req.body.title) return res.status(400).json({ error: 'Falta titulo' });
  const { data } = await supabase.from('tareas').insert(req.body);
  res.json(data);
});

// Bien: cada capa tiene su responsabilidad.
// route: define el endpoint y sus middlewares
// controller: traduce HTTP
// service: aplica reglas de negocio
// repository: accede a datos
```

Señales de violación:

- El archivo cambia por motivos de UI, base de datos y negocio a la vez.
- El nombre de la clase incluye "Manager", "Helper" o "Utils" y agrupa cosas no relacionadas.
- Una función de 200 líneas con varios `try/catch`.

### 6.2. O — Open/Closed Principle

El código debe estar **abierto a extensión y cerrado a modificación** en los puntos que realmente varían.

```js
// Mal: cada nuevo proveedor obliga a modificar el switch.
function generateEmbedding(provider, text) {
  if (provider === 'openai') return openaiEmbedding(text);
  if (provider === 'other') return otherEmbedding(text);
  throw new Error('Proveedor no soportado');
}

// Bien: contrato común y registro de proveedores.
const providers = new Map([
  ['openai', openAiEmbeddingProvider],
  ['other', otherEmbeddingProvider],
]);

function getEmbeddingProvider(name) {
  const provider = providers.get(name);
  if (!provider) throw ApiError.badRequest(`Proveedor no soportado: ${name}`);
  return provider;
}
```

No aplicar OCP a todo. Si solo hay una implementación estable, una interfaz adicional es complejidad innecesaria.

### 6.3. L — Liskov Substitution Principle

Un subtipo debe poder usarse donde se espera el tipo base sin romper el contrato.

```ts
// Mal: el subtipo cambia el contrato y lanza en métodos que el base permite.
class Repository {
  findById(id: string) { ... }
}
class CachedRepository extends Repository {
  findById(id: string) { throw new Error('No soportado'); } // rompe LSP
}
```

Regla práctica: si una subclase necesita lanzar "no implementado" o ignorar parámetros del contrato, la jerarquía está mal.

### 6.4. I — Interface Segregation Principle

Ningún consumidor debe depender de métodos que no usa. Preferir interfaces pequeñas y específicas.

```ts
// Mal: un servicio de solo lectura depende de un contrato enorme.
interface DocumentStore {
  findById(id: number): Promise<Document>;
  save(document: Document): Promise<void>;
  delete(id: number): Promise<void>;
  reprocess(id: number): Promise<void>;
  exportToPdf(id: number): Promise<Buffer>;
}

// Bien: contratos separados por uso.
interface DocumentReader { findById(id: number): Promise<Document>; }
interface DocumentWriter { save(document: Document): Promise<void>; }
```

En JavaScript, esto se traduce en módulos y funciones con APIs pequeñas, no en clases gigantes.

### 6.5. D — Dependency Inversion Principle

Los módulos de alto nivel no deben depender de detalles de bajo nivel. Ambos deben depender de abstracciones.

```js
// Mal: el servicio instancia Supabase directamente y es difícil de probar.
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function getSubjects(userId) {
  return supabase.from('materias').select('*').eq('usuario_id', userId);
}

// Bien: el servicio recibe el repositorio.
class SubjectService {
  constructor({ subjectRepository }) {
    this.subjectRepository = subjectRepository;
  }

  async listForUser(userId) {
    return this.subjectRepository.findByUserId(userId);
  }
}

// En pruebas se inyecta un doble.
const service = new SubjectService({ subjectRepository: fakeRepository });
```

En Angular, la inversión se logra con `inject()` y tokens de inyección para dependencias externas (por ejemplo, el cliente de Supabase o la configuración).

---

## 7. Cohesión, acoplamiento y estructura

- **Alta cohesión:** todo lo que está en un módulo pertenece al mismo concepto.
- **Bajo acoplamiento:** un cambio en un módulo no obliga a cambiar diez.
- **Dependencias en una dirección:** `routes → controllers → services → repositories → infrastructure`. Nunca al revés.
- **Sin dependencias circulares.**
- **Sin estado global mutable.** La configuración es inmutable una vez cargada.
- **Sin "utils" cajón de sastre.** Cada helper tiene un módulo con nombre propio.
- **Exportaciones explícitas.** Evitar `export *` indiscriminado.
- **Máximo de responsabilidades por archivo.** Si un archivo supera ~300 líneas, revisar si hace demasiado.

### Estructura por funcionalidad vs por capa

En MINGO se usa **capas en el backend** (`controllers`, `services`, `repositories`) y **features en el frontend**. Respetar esa organización:

- Un cambio de una funcionalidad debe tocar pocos archivos y todos relacionados.
- No crear un archivo "common" para algo que solo usa una feature.

---

## 8. Duplicación y reutilización

- Duplicar dos veces es aceptable; tres veces es señal de abstraer.
- Extraer cuando la lógica es **estable** y **conceptual**, no solo porque el texto se parece.
- No crear una abstracción prematura.
- Compartir esquemas Zod, tipos y constantes, no lógica de negocio entre módulos no relacionados.
- En frontend, componentes compartidos en `shared/`; lógica de dominio en `features/`.

---

## 9. Valores y constantes

- Sin **números mágicos** ni strings mágicos.
- Enums o constantes para estados, roles y tipos.

```js
// Mal
if (task.status === 'completada') { ... }
if (user.role === 'admin') { ... }

// Bien
const TASK_STATUS = Object.freeze({
  PENDING: 'pendiente',
  IN_PROGRESS: 'en_progreso',
  COMPLETED: 'completada',
});
if (task.status === TASK_STATUS.COMPLETED) { ... }
```

En TypeScript, preferir uniones de literales o `as const`:

```ts
export const TASK_STATUS = {
  PENDING: 'pendiente',
  IN_PROGRESS: 'en_progreso',
  COMPLETED: 'completada',
} as const;

export type TaskStatus = (typeof TASK_STATUS)[keyof typeof TASK_STATUS];
```

---

## 10. Pruebas

### 10.1. Pirámide

| Nivel | Qué prueba | Herramienta |
|---|---|---|
| Unitarias | Funciones y servicios con dependencias simuladas. | Jest / Vitest |
| Integración | Endpoint + validación + servicio + repositorio simulado. | Supertest |
| E2E | Flujo real de usuario y base de datos de prueba. | Manual o herramienta E2E |

La mayoría deben ser unitarias e integración rápidas. Las E2E son pocas y del flujo crítico.

### 10.2. Reglas

- Un test = un comportamiento.
- Nombre descriptivo en español: `it('rechaza una tarea sin titulo')`.
- Patrón **Arrange–Act–Assert**.
- Sin dependencia de red, hora real, orden de ejecución ni datos de producción.
- Sin `sleep`. Usar mocks o esperas deterministas.
- Cada test debe poder ejecutarse solo.
- Probar el caso feliz, los bordes y los errores.
- No probar detalles de implementación; probar comportamiento observable.
- No perseguir cobertura como número. Buscar cobertura de reglas de negocio.

### 10.3. Qué probar siempre

- Validaciones de entrada (campos obligatorios, límites, formatos).
- Reglas de negocio (propiedad del recurso, transiciones de estado, cálculos).
- Manejo de errores (404, 403, 401, 500 controlado).
- Casos de autorización: usuario A no accede a datos de usuario B.
- Frontend: estados de carga, vacío y error; lógica de componentes; guards e interceptores.

### 10.4. Dobles de prueba

| Tipo | Uso |
|---|---|
| **Stub** | Devuelve datos fijos. |
| **Mock** | Verifica que se llamó con los argumentos correctos. |
| **Fake** | Implementación simplificada en memoria. |
| **Spy** | Observa llamadas sin reemplazar todo. |

Preferir fakes para repositorios y stubs para clientes externos.

---

## 11. Revisión de código

### 11.1. Qué revisar

- [ ] ¿El cambio resuelve el requisito sin agregar alcance?
- [ ] ¿Los nombres comunican intención?
- [ ] ¿Hay duplicación o lógica que debería estar en otra capa?
- [ ] ¿Se validan todas las entradas?
- [ ] ¿Los errores son claros y no filtran información?
- [ ] ¿Hay pruebas para el comportamiento nuevo?
- [ ] ¿Se respetan las reglas de AWS?
- [ ] ¿Hay secretos, tokens o datos personales?
- [ ] ¿Se actualizó la documentación?
- [ ] ¿El código es más simple de lo que era?

### 11.2. Cómo comentar

- Señalar el problema, no a la persona.
- Explicar el impacto y proponer una alternativa.
- Distinguir bloqueante de sugerencia: `[bloqueante]`, `[sugerencia]`, `[pregunta]`.
- No reescribir el PR entero por preferencias personales.

---

## 12. Antipatrones frecuentes

| Antipatrón | Síntoma | Corrección |
|---|---|---|
| **God object** | Una clase o servicio hace todo. | Dividir por responsabilidad. |
| **Copia y pega** | La misma regla en varios archivos. | Extraer a servicio o función. |
| **Números mágicos** | `if (status === 3)`. | Constantes o enums. |
| **Anidamiento profundo** | `if` dentro de `if` dentro de `for`. | Guard clauses y funciones pequeñas. |
| **Catch vacío** | `catch (e) {}`. | Registrar y manejar o relanzar. |
| **Boolean blindness** | `doThing(true, false)`. | Objeto de opciones o enums. |
| **Primitive obsession** | Strings y números para todo. | Tipos y validaciones de dominio. |
| **Feature envy** | Una función usa más datos de otra clase que de la propia. | Mover la lógica. |
| **Shotgun surgery** | Un cambio obliga a tocar 10 archivos. | Consolidar responsabilidad. |
| **Premature optimization** | Optimizar sin medir. | Medir primero. |
| **Abstraction astronaut** | Interfaces y factories para todo. | Solución simple. |
| **Magic framework** | El framework lo hace todo y nadie entiende. | Código explícito. |
| **Commented-out code** | Código muerto comentado. | Eliminar. |
| **Inconsistent naming** | `getUser`, `fetchUser`, `loadUser`. | Un verbo por operación. |

---

## 13. Checklist de calidad

Antes de dar una tarea por terminada:

- [ ] Los nombres son claros y consistentes.
- [ ] Cada función tiene una responsabilidad.
- [ ] No hay duplicación evitable ni código muerto.
- [ ] No hay números o strings mágicos.
- [ ] Las entradas se validan y los errores se manejan.
- [ ] No se exponen datos internos ni secretos.
- [ ] Las dependencias apuntan en la dirección correcta.
- [ ] Hay pruebas del comportamiento nuevo.
- [ ] Lint, pruebas y build pasan.
- [ ] La documentación afectada está actualizada.
- [ ] El cambio cumple las reglas de AWS.
