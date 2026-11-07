# Seguridad de MINGO

**Versión:** 1.0  
**Alcance:** frontend, backend, base de datos, almacenamiento, IA e infraestructura AWS.  
**Principio rector:** mínimo privilegio, cero confianza en el cliente y separación estricta de datos entre estudiantes.

## 1. Modelo de seguridad

```text
Usuario
  | 1. Login con Supabase Auth (correo + contraseña)
  v
Supabase Auth  ---> access_token (JWT, vida corta) + refresh_token
  |
  | 2. Angular envía Authorization: Bearer <access_token>
  v
API Gateway + Lambda
  | 3. auth.middleware valida el JWT contra Supabase
  | 4. roles.middleware verifica el rol
  | 5. validation.middleware valida la entrada con Zod
  | 6. repositories consultan con filtro de propietario
  v
Supabase PostgreSQL (RLS activo como segunda barrera)
```

**Defensa en profundidad:** ningún control es único. Aunque falle el backend, RLS debe impedir el acceso cruzado. Aunque falle RLS, el repository debe filtrar por `usuario_id`.

## 2. Autenticación

### 2.1. Responsabilidades

| Componente | Responsabilidad |
|---|---|
| Supabase Auth | Registro, login, recuperación de contraseña, emisión y refresco de tokens. |
| Angular | Guardar la sesión de forma segura, enviar el token y renovarlo. |
| Backend | Validar el token en cada solicitud y obtener la identidad. |
| Base de datos | Aplicar RLS con `auth.uid()`. |

### 2.2. Reglas de tokens

- El `access_token` viaja solo en la cabecera `Authorization: Bearer`.
- **Nunca** en la URL, en logs, en localStorage compartido con scripts de terceros ni en el HTML.
- El refresh token lo gestiona el SDK de Supabase; no se manipula manualmente.
- El backend valida el token con `supabase.auth.getUser(token)`. No se decodifica el JWT sin verificar la firma.
- Se rechaza el token si:
  - está ausente, vencido o mal formado;
  - el usuario no existe;
  - el perfil está `inactivo`;
  - el `aud` o `iss` no corresponden al proyecto Supabase.
- Al cerrar sesión se revoca la sesión en Supabase.

### 2.3. Reglas de contraseñas

- Mínimo 8 caracteres (Supabase permite configurar más; se recomienda 10).
- Contraseñas filtradas por Supabase (HaveIBeenPwned) activadas si el plan lo permite.
- Sin preguntas de seguridad.
- Recuperación por correo con enlace de un solo uso.
- Bloqueo temporal tras intentos fallidos repetidos (configuración de Supabase + rate limit).
- No se registran contraseñas, ni siquiera hasheadas, en logs.

## 3. Autorización y roles

### 3.1. Roles del MVP

| Rol | Acceso |
|---|---|
| `estudiante` | Solo sus propios datos académicos, documentos, conversaciones y estadísticas. |
| `administrador` | Panel administrativo, usuarios, roles, estadísticas agregadas, auditoría y configuración de IA. |

El rol se guarda en `roles` + `usuario_roles`. La fuente de verdad es la base de datos; `app_metadata.role` puede usarse como caché de autorización, nunca como única validación.

### 3.2. Middlewares

```js
// Uso esperado en las rutas
router.use(authMiddleware);
router.get('/', controller.listar);
router.post('/', requireRole('administrador'), controller.crear);
```

- `auth.middleware.js`: valida el token y deja `req.user = { id, email, roles }`.
- `roles.middleware.js`: exige al menos uno de los roles indicados.
- `validation.middleware.js`: valida `body`, `query` y `params` con Zod.
- `error.middleware.js`: convierte errores a la forma estándar sin filtrar detalles internos.

### 3.3. Reglas de propiedad

- Toda consulta de datos de usuario incluye `usuario_id = req.user.id`.
- Toda actualización verifica primero que el recurso pertenece al usuario.
- Un recurso de otro usuario responde `404`, no `403`.
- El administrador **no** hereda permisos sobre contenido privado.
- Los cambios de rol no pueden aplicarse a sí mismo.

## 4. Row Level Security (RLS)

- RLS activo en **todas** las tablas del dominio. Sin política, el acceso se deniega.
- El frontend usa la clave `anon`; nunca la `service_role`.
- El backend usa `service_role` solo para tareas administrativas acotadas y **siempre** filtra por propietario.
- Las funciones `security definer` requieren revisión de otra persona, `search_path` fijo y justificación.
- Las pruebas de RLS se hacen con dos usuarios distintos (ver [plan-pruebas.md](plan-pruebas.md)).

Detalle de políticas y funciones en [base-datos.md](base-datos.md), sección 6.

## 5. Secretos y credenciales

### 5.1. Reglas

- **Nunca** subir `.env`, claves, tokens ni certificados al repositorio.
- `.env` está en `.gitignore`; se versiona solo `.env.example` con valores vacíos o de ejemplo.
- Los secretos viven en:
  - variables de entorno del pipeline de GitHub Actions;
  - variables de entorno de Lambda;
  - SSM Parameter Store Standard para configuración no secreta.
- No se usa Secrets Manager ni KMS de cliente por costo (ver [reglas-aws.md](reglas-aws.md)).
- Las claves de IA y AWS **nunca** llegan al frontend.
- Rotación de claves: cada 90 días o ante sospecha de filtración.
- Si un secreto se filtra: revocarlo de inmediato, sustituirlo, revisar logs de uso y documentar el incidente.

### 5.2. Claves por entorno

| Entorno | Supabase | AWS | IA |
|---|---|---|---|
| Desarrollo | Proyecto `mingo-dev` | Opcional / sin desplegar | Clave con límite bajo |
| Pruebas | Proyecto `mingo-test` o mocks | Mocks | Mock o clave mínima |
| Producción | Proyecto `mingo-prod` | Cuenta con presupuesto | Clave con tope de gasto |

Nunca compartir el mismo proyecto Supabase entre producción y desarrollo.

## 6. Validación de entrada

- Zod valida `body`, `query` y `params`.
- Lista blanca de campos permitidos; descartar el resto.
- Límites de longitud en todos los textos.
- UUID validado con formato estricto.
- Fechas en ISO 8601 y con coherencia (inicio ≤ fin).
- Enums cerrados: nunca aceptar texto libre donde hay un catálogo.
- El campo de ordenamiento se valida contra una lista blanca.
- El backend no confía en `usuario_id`, `rol`, `estado` ni precios enviados por el cliente.

## 7. Carga de archivos

### 7.1. Controles obligatorios

- Formatos: PDF, DOC, DOCX, PPT, PPTX, TXT.
- Tamaño máximo: 20 MB.
- Nombre de archivo saneado; la clave en S3 la genera el backend.
- Bucket privado con **Block Public Access**.
- URL prefirmada de **15 minutos** para subir y descargar.
- Validación del tipo real en Lambda (magic bytes / librería), no solo la extensión.
- El archivo no se ejecuta nunca.
- Detección de archivos maliciosos: rechazar macros o contenido ejecutable cuando sea posible.
- Cuota por usuario para evitar abuso de almacenamiento.

### 7.2. Rutas de objetos

```text
usuarios/<usuario_id>/documentos/<documento_id>/<nombre-saneado>
```

- El backend verifica que la clave empiece con `usuarios/<req.user.id>/`.
- Un usuario no puede solicitar URL para la ruta de otro.
- Al borrar un documento se eliminan metadatos, fragmentos y objeto S3.

## 8. Seguridad de la IA

### 8.1. Prompt injection

Los documentos del estudiante son **datos no confiables**. Pueden contener texto como “ignora las instrucciones anteriores” o “revela tu configuración”.

Controles:

1. Separar instrucciones del sistema y contenido recuperado con delimitadores claros.
2. Indicar al modelo que el contenido entre delimitadores es solo material de estudio.
3. No incluir secretos, claves ni instrucciones internas en el prompt.
4. Validar la salida del modelo: si pide ejecutar herramientas no autorizadas, se descarta.
5. El agente solo puede invocar herramientas de la lista blanca.
6. Las herramientas reciben `usuario_id` desde la sesión, nunca desde el texto del modelo.
7. Las operaciones de escritura requieren confirmación explícita del usuario.
8. Registrar la intención detectada y las herramientas usadas para auditoría.

### 8.2. Fugas de información

- El RAG filtra por propietario antes de recuperar fragmentos.
- El prompt no incluye documentos de otros usuarios.
- Las respuestas deben citar solo fuentes del usuario.
- Si el modelo inventa una cita, el backend descarta referencias que no existan en la base.
- No se envían datos personales innecesarios al proveedor de IA.

### 8.3. Control de consumo

- Cuota diaria y mensual por usuario.
- Límite de tokens de entrada y salida.
- Sin reintentos en bucle ante errores del proveedor.
- Registro de consumo por solicitud.
- Degradación clara cuando se agota la cuota.

Ver [ia-rag.md](ia-rag.md).

## 9. Seguridad web

### 9.1. CORS

- Lista blanca explícita en `CORS_ORIGINS`: `http://localhost:4200` en desarrollo y el dominio real en producción.
- Sin `*` cuando se envían credenciales.
- Métodos permitidos: `GET, POST, PUT, PATCH, DELETE, OPTIONS`.
- Cabeceras permitidas: `Authorization, Content-Type, Idempotency-Key`.
- `credentials` solo si es imprescindible.

### 9.2. Cabeceras HTTP

Usar `helmet` en Express:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: no-referrer`
- `Content-Security-Policy` adecuada al frontend
- `Strict-Transport-Security` en producción (HTTPS)
- Ocultar `X-Powered-By`

### 9.3. Rate limiting

| Ámbito | Límite propuesto |
|---|---|
| Global por IP + usuario | 300 solicitudes / 15 min |
| Login / registro | 10 intentos / 15 min |
| Chat IA | 30 mensajes / hora por usuario |
| Resúmenes / cuestionarios | 20 generaciones / día por usuario |
| Subida de documentos | 20 archivos / día por usuario |

- Configurar también throttling en API Gateway (20 req/s, burst 40).
- Responder `429` con `Retry-After`.
- No revelar en el mensaje si el límite es por IP o por usuario.

### 9.4. Frontend

- No almacenar tokens en `localStorage` si se puede usar el almacenamiento seguro del SDK.
- Sanitizar cualquier HTML generado por IA antes de mostrarlo (`DomSanitizer`).
- No usar `innerHTML` con contenido del modelo.
- Guards para rutas autenticadas y rutas de administrador.
- Interceptor que agrega el token y maneja `401` redirigiendo al login.
- No incluir claves privadas en `environment.ts`.

## 10. Registro y auditoría

### 10.1. Qué registrar

- Inicio y cierre de sesión (sin contraseñas).
- Cambios de rol y estado de cuenta.
- Acciones administrativas.
- Errores 5xx con identificador de correlación.
- Consumo de IA por usuario (tokens y modelo).
- Intentos de acceso denegado relevantes.
- Eventos de procesamiento de documentos (inicio, fin, error).

### 10.2. Qué NO registrar

- Contraseñas, tokens o claves.
- Contenido completo de documentos.
- Embeddings.
- Conversaciones completas con la IA.
- Datos personales innecesarios.
- Direcciones IP con retención indefinida.

### 10.3. Retención

- Logs de aplicación: 7 días en desarrollo, 30 días en producción.
- Auditoría administrativa: según necesidad del proyecto, sin datos sensibles.
- Nunca dejar grupos de CloudWatch con “Never expire”.

## 11. Seguridad de infraestructura AWS

- Root solo para crear la cuenta; MFA y sin access keys.
- Usuario o rol IAM de despliegue con mínimo privilegio y MFA.
- GitHub Actions con OIDC, sin claves estáticas si es posible.
- Un rol por función Lambda.
- Sin permisos `*` en acciones ni recursos.
- Sin bucket público, sin ACL públicas.
- Sin EC2, sin VPC, sin NAT Gateway, sin balanceadores.
- Presupuestos y alertas activos (ver [reglas-aws.md](reglas-aws.md)).
- Etiquetas obligatorias en todos los recursos.

## 12. Respuesta a incidentes

### 12.1. Clasificación

| Nivel | Ejemplo | Acción |
|---|---|---|
| Crítico | Fuga de datos, credenciales expuestas, acceso cruzado entre usuarios. | Contención inmediata, revocación de claves, notificación al equipo. |
| Alto | Cuenta de administrador comprometida, cobro inesperado alto. | Bloqueo de cuenta, revisión de logs, corrección. |
| Medio | Abuso de cuota de IA, archivo malicioso detectado. | Bloquear usuario o archivo, revisar límites. |
| Bajo | Intento fallido de login repetido, error de validación. | Monitorear, ajustar rate limit. |

### 12.2. Procedimiento

1. **Detectar y confirmar** el incidente.
2. **Contener:** revocar tokens/claves, desactivar la cuenta o poner la concurrencia de Lambda en 0.
3. **Preservar evidencia:** guardar logs relevantes sin datos sensibles.
4. **Erradicar:** corregir la causa raíz.
5. **Recuperar:** restaurar el servicio y verificar que RLS y permisos funcionan.
6. **Documentar:** qué pasó, impacto, causa, acciones y prevención.
7. **Comunicar** si hay datos personales afectados, según corresponda.

### 12.3. Contactos y responsables

Definir en el repositorio (sin datos personales sensibles):

- Responsable de seguridad.
- Responsable de infraestructura.
- Responsable de base de datos.
- Canal interno de emergencia.

## 13. Checklist de seguridad por cambio

- [ ] El endpoint requiere autenticación salvo excepción justificada.
- [ ] El rol se valida en el backend.
- [ ] La consulta filtra por `usuario_id`.
- [ ] La entrada se valida con Zod.
- [ ] No se exponen datos de otros usuarios.
- [ ] No se agregaron secretos al código ni a los logs.
- [ ] El archivo subido se valida por tipo y tamaño.
- [ ] El consumo de IA tiene límite.
- [ ] La respuesta no filtra detalles internos.
- [ ] Se agregó o actualizó una prueba de seguridad.
- [ ] RLS sigue activo en las tablas afectadas.

Si alguna casilla falta, el cambio **no se aprueba**.
