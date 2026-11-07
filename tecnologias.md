# MINGO
## Documento de arquitectura tecnológica, herramientas y diseño del sistema

**Versión:** 1.0  
**Tipo de proyecto:** Aplicación web académica inteligente  
**Arquitectura:** Frontend Angular + Backend Node.js MVC + Servicios Cloud  
**Base de datos:** Supabase PostgreSQL  
**Enfoque:** Serverless e integración con inteligencia artificial

---

# 1. Arquitectura tecnológica general

MINGO se desarrollará utilizando una arquitectura cliente-servidor, separando claramente la interfaz de usuario, la lógica de negocio, el acceso a datos y los servicios externos.

La solución combinará tecnologías de desarrollo web con servicios de AWS y Supabase.

Se busca construir una aplicación modular, escalable, segura y fácil de mantener, que permita incorporar nuevas funcionalidades sin afectar los módulos existentes.

La arquitectura estará dividida en cinco componentes principales:

1. Frontend: interfaz web desarrollada con Angular.
2. Backend: API REST desarrollada con Node.js y Express.
3. Base de datos: PostgreSQL administrado mediante Supabase.
4. Infraestructura cloud: servicios serverless de AWS.
5. Inteligencia artificial: modelo de lenguaje y sistema RAG para el agente académico.

# 2. Tecnologías y lenguajes de programación

## 2.1. Frontend

**Angular + TypeScript**

Angular será el framework principal para desarrollar la interfaz de usuario de MINGO.

Se utilizará TypeScript para mantener un código organizado, tipado y fácil de mantener.

Tecnologías:

| Tecnología | Uso |
|---|---|
| Angular | Framework principal de la aplicación |
| TypeScript | Lenguaje de programación |
| HTML5 | Estructura de las interfaces |
| CSS3 | Estilos y diseño visual |
| Bootstrap | Componentes y diseño responsivo |
| Angular Router | Navegación entre módulos |
| Angular Services | Comunicación con el backend |
| RxJS | Manejo de operaciones asíncronas |
| Angular Reactive Forms | Formularios y validaciones |
| HttpClient | Consumo de API REST |

### Organización del frontend

El frontend estará organizado por módulos y funcionalidades para evitar concentrar toda la aplicación en un único componente.

Estructura propuesta:

```text
frontend/
│
├── src/
│   ├── app/
│   │   ├── core/
│   │   │   ├── guards/
│   │   │   ├── interceptors/
│   │   │   ├── services/
│   │   │   └── models/
│   │   │
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   ├── pipes/
│   │   │   └── directives/
│   │   │
│   │   ├── features/
│   │   │   ├── auth/
│   │   │   ├── dashboard/
│   │   │   ├── materias/
│   │   │   ├── tareas/
│   │   │   ├── calendario/
│   │   │   ├── biblioteca/
│   │   │   ├── centro-estudio/
│   │   │   ├── asistente-ia/
│   │   │   └── administracion/
│   │   │
│   │   ├── layout/
│   │   └── app.routes.ts
│   │
│   └── assets/
│
└── angular.json
```

**Responsabilidades principales:**

- Mostrar la información académica.
- Gestionar las interacciones del estudiante.
- Consumir los endpoints del backend.
- Mostrar las respuestas del agente de IA.
- Gestionar formularios y validaciones visuales.
- Controlar la navegación según los permisos del usuario.

El frontend no tendrá acceso directo a las credenciales administrativas de Supabase, AWS ni del proveedor de inteligencia artificial.

## 2.2. Backend

**Node.js + JavaScript + Express.js**

Node.js será el entorno de ejecución del backend y Express.js permitirá construir una API REST para conectar el frontend con la lógica de negocio.

Se utilizará JavaScript para desarrollar los controladores, servicios, modelos y componentes de integración.

El backend seguirá una arquitectura MVC complementada con una capa de servicios y repositorios.

Tecnologías:

| Tecnología | Uso |
|---|---|
| Node.js | Entorno de ejecución |
| JavaScript | Lenguaje del backend |
| Express.js | Framework para API REST |
| Zod | Validación de datos |
| JWT | Validación de tokens de autenticación |
| Supabase JS | Comunicación con Supabase |
| AWS SDK for JavaScript | Comunicación con servicios AWS |
| Multer | Gestión inicial de archivos recibidos |
| dotenv | Variables de entorno |
| Jest | Pruebas unitarias |
| Supertest | Pruebas de endpoints |

### Organización del backend

Se utilizará una estructura modular basada en MVC.

```text
backend/
│
├── src/
│   ├── config/
│   │   ├── database.js
│   │   ├── supabase.js
│   │   ├── aws.js
│   │   └── environment.js
│   │
│   ├── models/
│   │   ├── usuario.model.js
│   │   ├── materia.model.js
│   │   ├── tarea.model.js
│   │   ├── documento.model.js
│   │   └── estudio.model.js
│   │
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── usuario.controller.js
│   │   ├── materia.controller.js
│   │   ├── tarea.controller.js
│   │   ├── calendario.controller.js
│   │   ├── documento.controller.js
│   │   ├── estudio.controller.js
│   │   └── asistente.controller.js
│   │
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── usuario.service.js
│   │   ├── materia.service.js
│   │   ├── tarea.service.js
│   │   ├── calendario.service.js
│   │   ├── documento.service.js
│   │   ├── almacenamiento.service.js
│   │   ├── notificacion.service.js
│   │   │
│   │   └── ia/
│   │       ├── agente.service.js
│   │       ├── rag.service.js
│   │       ├── embeddings.service.js
│   │       ├── resumen.service.js
│   │       ├── tutor.service.js
│   │       ├── evaluador.service.js
│   │       └── planificador.service.js
│   │
│   ├── repositories/
│   │   ├── usuario.repository.js
│   │   ├── materia.repository.js
│   │   ├── tarea.repository.js
│   │   ├── documento.repository.js
│   │   └── estudio.repository.js
│   │
│   ├── middlewares/
│   │   ├── auth.middleware.js
│   │   ├── roles.middleware.js
│   │   ├── validation.middleware.js
│   │   └── error.middleware.js
│   │
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── usuario.routes.js
│   │   ├── materia.routes.js
│   │   ├── tarea.routes.js
│   │   ├── calendario.routes.js
│   │   ├── documento.routes.js
│   │   ├── estudio.routes.js
│   │   └── asistente.routes.js
│   │
│   ├── utils/
│   ├── app.js
│   └── server.js
│
├── tests/
├── .env
└── package.json
```

# 3. Arquitectura MVC del backend

El backend utilizará el patrón Modelo-Vista-Controlador (MVC), adaptado a una API REST.

Como el frontend estará separado y desarrollado con Angular, la capa View tradicional de MVC estará representada por la interfaz web. El backend se concentrará en recibir solicitudes, ejecutar las reglas de negocio y devolver respuestas en formato JSON.

Además, se incorporarán servicios y repositorios para mantener una separación clara de responsabilidades.

## 3.1. Model

Representa las entidades y estructuras de información utilizadas por el sistema.

Responsabilidades:

- Definir las estructuras de los datos.
- Representar las entidades académicas.
- Gestionar las relaciones entre entidades.
- Facilitar el acceso estructurado a la información.

Ejemplo: Usuario, Materia, Tarea, Documento y Sesión de estudio.

## 3.2. View

Corresponde a las interfaces desarrolladas con Angular.

Responsabilidades:

- Presentar los datos al estudiante.
- Mostrar formularios.
- Visualizar resultados.
- Permitir la interacción con el sistema.

## 3.3. Controller

Es el encargado de recibir las solicitudes HTTP y coordinar las operaciones necesarias.

Responsabilidades:

- Recibir solicitudes.
- Validar parámetros y datos de entrada.
- Invocar los servicios correspondientes.
- Devolver respuestas HTTP.
- Gestionar los errores de las solicitudes.

Ejemplo: `tarea.controller.js` recibe una solicitud para registrar una nueva tarea y delega la operación al servicio correspondiente.

## 3.4. Service

Contiene la lógica de negocio de la aplicación.

Responsabilidades:

- Ejecutar las reglas del sistema.
- Coordinar operaciones entre diferentes módulos.
- Aplicar validaciones de negocio.
- Invocar servicios externos.
- Gestionar las operaciones del agente de IA.

Ejemplo: `planificador.service.js` construye una propuesta de estudio utilizando las fechas de exámenes, disponibilidad y temas registrados.

## 3.5. Repository

Se encarga de la comunicación con la base de datos.

Responsabilidades:

- Consultar información.
- Insertar registros.
- Actualizar datos.
- Eliminar registros.
- Ejecutar consultas específicas.

Los controladores no realizarán consultas SQL directamente.

### Flujo de funcionamiento

```text
Angular Frontend
       |
       | HTTP Request
       v
Express Routes
       |
       v
Middlewares
       |
       v
Controller
       |
       v
Service
       |
       v
Repository
       |
       v
Supabase PostgreSQL
       |
       v
Respuesta al Frontend
```

Para operaciones que requieran IA o servicios AWS, la capa Service podrá comunicarse con los servicios externos y utilizar los resultados antes de devolver la respuesta.

# 4. Servicios de AWS

Se utilizarán servicios de AWS con un enfoque Serverless, buscando aprovechar los niveles gratuitos disponibles y mantener un costo inicial reducido.

La selección de servicios estará orientada al procesamiento de documentos, almacenamiento, ejecución de procesos y notificaciones.

**Importante:** AWS modifica sus condiciones de Free Tier y algunos beneficios dependen de la antigüedad y modalidad de la cuenta. Antes de desplegar se deberán revisar las condiciones vigentes. No se asumirá que todos los servicios son gratuitos de manera permanente.

## 4.1. AWS Lambda

**Función:** ejecución de código sin administrar servidores.

Se utilizará para ejecutar procesos independientes del backend tradicional.

Ejemplos:

- Procesar documentos cargados.
- Extraer texto de archivos.
- Generar tareas de procesamiento de IA.
- Ejecutar procesos programados.
- Enviar notificaciones.
- Realizar tareas en segundo plano.

Se utilizará Node.js como runtime cuando sea compatible con la función.

## 4.2. Amazon API Gateway

**Función:** exponer y administrar endpoints HTTP para las funciones Lambda.

Permitirá que los servicios serverless puedan ser invocados mediante solicitudes HTTP controladas.

Se podrá utilizar para endpoints especializados como:

- Procesamiento de documentos.
- Generación de resúmenes.
- Consultas al agente de IA.
- Procesamiento de notificaciones.

El backend Express podrá permanecer como API principal y comunicarse con las funciones Lambda cuando sea necesario.

## 4.3. Amazon S3

**Función:** almacenamiento de archivos.

Se utilizará para guardar los documentos académicos que los estudiantes carguen en MINGO.

Ejemplos:

- PDF.
- Documentos Word.
- Presentaciones.
- Materiales de estudio.
- Archivos generados por el sistema.

Los archivos estarán organizados mediante rutas asociadas al usuario y a la materia.

El bucket será privado y el acceso se realizará mediante permisos controlados y URLs prefirmadas de corta duración.

## 4.4. AWS IAM

**Función:** administración de permisos y acceso a los servicios AWS.

Se utilizará para definir qué recursos puede utilizar cada componente del sistema.

Se crearán roles y políticas con privilegios mínimos.

Ejemplos:

- Permitir a una Lambda leer documentos de un bucket específico.
- Permitir a una Lambda escribir archivos procesados.
- Autorizar operaciones necesarias de notificación.

No se utilizarán credenciales root dentro del código de la aplicación.

## 4.5. Amazon SNS

**Función:** servicio de notificaciones y publicación de mensajes.

Se podrá utilizar para enviar notificaciones relacionadas con acontecimientos académicos.

Ejemplos:

- Avisos de tareas próximas a vencer.
- Recordatorios de actividades.
- Notificaciones de procesamiento de documentos.
- Avisos de finalización de operaciones.

Su implementación se realizará después de tener funcionando las notificaciones básicas de la plataforma.

## 4.6. Amazon EventBridge (etapa posterior)

**Función:** programación y coordinación de eventos.

Podrá utilizarse para ejecutar procesos periódicos, como:

- Revisar actividades próximas a vencer.
- Generar recordatorios.
- Ejecutar tareas programadas.
- Coordinar procesos automáticos.

Su incorporación dependerá de las necesidades y del presupuesto disponible.

# 5. Supabase y base de datos

Supabase será la plataforma principal para gestionar la información de MINGO.

Se utilizará PostgreSQL como sistema de gestión de bases de datos relacional.

La elección de PostgreSQL permitirá representar las relaciones entre usuarios, materias, tareas, documentos y actividades académicas.

## 5.1. Servicios de Supabase

| Servicio | Uso |
|---|---|
| Supabase Auth | Registro y autenticación |
| PostgreSQL | Base de datos principal |
| Supabase Storage | Alternativa de almacenamiento para el MVP |
| pgvector | Almacenamiento y búsqueda de embeddings |
| Row Level Security | Protección de los datos por usuario |
| Supabase Client | Comunicación con los servicios |

Para evitar duplicar el almacenamiento, se utilizará una estrategia definida: los documentos podrán almacenarse en S3 y sus metadatos en PostgreSQL. Supabase Storage quedará como alternativa si se decide simplificar la primera versión.

## 5.2. Diseño de la base de datos

La base de datos se organizará en módulos relacionados.

### A. Usuarios y autenticación

**Tabla: perfiles**

Almacena la información complementaria de cada usuario registrado.

- id
- auth_user_id
- nombre
- apellido
- correo
- foto_perfil
- universidad
- carrera
- semestre
- estado
- fecha_creacion

El identificador de autenticación estará relacionado con el usuario correspondiente de Supabase Auth.

**Tabla: roles**

Define los roles disponibles dentro del sistema.

- id
- nombre
- descripcion

**Tabla: usuario_roles**

Relaciona usuarios con los roles asignados.

- id
- usuario_id
- rol_id

### B. Organización académica

**Tabla: periodos_academicos**

- id
- usuario_id
- nombre
- fecha_inicio
- fecha_fin
- estado

**Tabla: materias**

- id
- usuario_id
- periodo_id
- nombre
- codigo
- docente
- descripcion
- color
- estado
- fecha_creacion

**Tabla: unidades**

- id
- materia_id
- nombre
- descripcion
- orden

### C. Tareas y evaluaciones

**Tabla: tareas**

- id
- usuario_id
- materia_id
- unidad_id
- titulo
- descripcion
- tipo
- prioridad
- fecha_asignacion
- fecha_entrega
- estado
- fecha_creacion

**Tabla: eventos_calendario**

- id
- usuario_id
- materia_id
- tarea_id
- titulo
- descripcion
- tipo_evento
- fecha_inicio
- fecha_fin
- recordatorio
- estado

### D. Biblioteca documental

**Tabla: documentos**

- id
- usuario_id
- materia_id
- unidad_id
- nombre
- nombre_archivo
- tipo_archivo
- ruta_almacenamiento
- tamano
- estado_procesamiento
- fecha_carga

**Tabla: fragmentos_documento**

Almacena los fragmentos de texto obtenidos durante el procesamiento de documentos.

- id
- documento_id
- contenido
- numero_pagina
- numero_fragmento
- embedding
- fecha_creacion

El campo embedding podrá utilizar el tipo vector de pgvector para permitir búsquedas semánticas.

### E. Inteligencia artificial

**Tabla: conversaciones**

- id
- usuario_id
- titulo
- tipo_conversacion
- fecha_creacion
- fecha_actualizacion

**Tabla: mensajes**

- id
- conversacion_id
- rol_mensaje
- contenido
- modelo_utilizado
- fecha_creacion

**Tabla: referencias_respuesta**

- id
- mensaje_id
- fragmento_id
- documento_id
- numero_pagina

Permitirá relacionar las respuestas del agente con los fragmentos documentales utilizados como referencia.

**Tabla: planes_estudio**

- id
- usuario_id
- materia_id
- titulo
- objetivo
- fecha_inicio
- fecha_fin
- estado
- fecha_creacion

**Tabla: sesiones_estudio**

- id
- plan_id
- materia_id
- titulo
- descripcion
- fecha_programada
- duracion_minutos
- estado

### F. Evaluaciones y aprendizaje

**Tabla: cuestionarios**

- id
- usuario_id
- materia_id
- documento_id
- titulo
- descripcion
- cantidad_preguntas
- fecha_creacion

**Tabla: preguntas**

- id
- cuestionario_id
- enunciado
- tipo_pregunta
- explicacion
- respuesta_correcta

**Tabla: opciones_pregunta**

- id
- pregunta_id
- contenido
- es_correcta

**Tabla: intentos_cuestionario**

- id
- usuario_id
- cuestionario_id
- puntuacion
- fecha_inicio
- fecha_finalizacion

**Tabla: respuestas_usuario**

- id
- intento_id
- pregunta_id
- respuesta
- es_correcta

### G. Notificaciones

**Tabla: notificaciones**

- id
- usuario_id
- titulo
- mensaje
- tipo
- fecha_programada
- fecha_envio
- leida
- estado

### H. Seguimiento y preferencias

**Tabla: objetivos_estudio**

- id
- usuario_id
- materia_id
- titulo
- descripcion
- fecha_limite
- estado
- fecha_creacion

**Tabla: preferencias_usuario**

- id
- usuario_id
- notificaciones_activas
- zona_horaria
- idioma
- configuracion_ia

Este diseño inicial podrá evolucionar durante el desarrollo, pero permitirá construir los módulos principales sin mezclar información de diferentes estudiantes.

# 6. Relaciones principales de la base de datos

Las relaciones principales serán:

- Un usuario puede tener varios periodos académicos.
- Un periodo académico puede contener varias materias.
- Un usuario puede registrar varias materias.
- Una materia puede contener varias unidades.
- Una materia puede tener varias tareas.
- Una materia puede tener varios documentos.
- Un documento puede contener muchos fragmentos.
- Un usuario puede tener varias conversaciones.
- Una conversación puede contener muchos mensajes.
- Un mensaje puede tener varias referencias documentales.
- Un usuario puede crear varios planes de estudio.
- Un plan puede contener varias sesiones.
- Una materia puede tener varios cuestionarios.
- Un cuestionario puede contener varias preguntas.
- Una pregunta puede tener varias opciones.
- Un cuestionario puede tener varios intentos.
- Un intento puede contener varias respuestas.

Se utilizarán claves primarias, claves foráneas, restricciones e índices para mantener la integridad de la información.

También se establecerán políticas RLS para asegurar que cada estudiante solamente pueda acceder a sus propios registros.

# 7. Usuarios y roles del sistema

MINGO contará inicialmente con dos roles principales: Administrador y Estudiante.

## 7.1. Administrador

Será responsable de la administración general de la plataforma.

Permisos:

- Acceder al panel administrativo.
- Consultar y gestionar usuarios.
- Activar o desactivar cuentas.
- Asignar y modificar roles.
- Consultar estadísticas generales del sistema.
- Administrar configuraciones generales.
- Supervisar el estado de los servicios.
- Gestionar parámetros y límites de uso de IA.
- Consultar registros de auditoría.

El administrador no tendrá acceso automático al contenido privado de estudio, documentos o conversaciones de los estudiantes. Cualquier acceso excepcional deberá estar justificado, autorizado y registrado.

## 7.2. Estudiante

Será el usuario principal de MINGO.

Permisos:

- Registrar y administrar su perfil.
- Crear y gestionar sus materias.
- Registrar tareas y evaluaciones.
- Administrar su calendario.
- Cargar documentos.
- Organizar su biblioteca.
- Utilizar el agente de IA.
- Generar resúmenes.
- Crear cuestionarios y simulacros.
- Crear planes de estudio.
- Consultar su progreso.
- Configurar recordatorios y notificaciones.
- Gestionar sus conversaciones.

Cada estudiante tendrá un espacio de trabajo independiente.

## 7.3. Roles futuros

En futuras versiones se podrá incorporar un rol de Docente.

Este rol podría permitir:

- Crear espacios académicos compartidos.
- Publicar materiales.
- Crear actividades.
- Compartir cuestionarios.
- Consultar el progreso de estudiantes autorizados.

Este rol no formará parte de la primera versión, ya que MINGO estará orientado inicialmente al uso individual de los estudiantes.

# 8. Autenticación y autorización

La autenticación se realizará mediante Supabase Auth.

El flujo será:

1. El usuario se registra o inicia sesión.
2. Supabase Auth valida sus credenciales.
3. Se genera un token de acceso.
4. Angular utiliza el token para realizar solicitudes.
5. El backend recibe el token.
6. Un middleware valida el token utilizando mecanismos oficiales de verificación de Supabase.
7. El middleware identifica al usuario.
8. El middleware de roles verifica los permisos necesarios.
9. El controlador procesa la solicitud.

Se implementarán los siguientes mecanismos:

- `auth.middleware.js`: verifica la identidad del usuario.
- `roles.middleware.js`: controla los permisos por rol.
- Row Level Security: protege el acceso a los registros de PostgreSQL.

El backend utilizará únicamente las credenciales necesarias y nunca expondrá claves administrativas al frontend.

# 9. Arquitectura del agente de inteligencia artificial

El agente de MINGO tendrá una arquitectura modular.

Se implementará un agente principal encargado de interpretar las solicitudes y coordinar herramientas especializadas.

No es necesario crear varios agentes autónomos desde el principio. Se comenzará con un agente central y servicios especializados que podrán evolucionar hacia agentes independientes si el proyecto lo requiere.

## 9.1. Componentes

**Agente principal**

- Comprende la solicitud.
- Identifica la intención.
- Consulta el contexto del estudiante.
- Selecciona las herramientas necesarias.
- Coordina las operaciones.
- Genera la respuesta final.

**Servicio RAG**

- Recupera información de documentos.
- Realiza búsquedas semánticas.
- Proporciona fragmentos relevantes.
- Conserva referencias a las fuentes.

**Servicio tutor**

- Explica conceptos.
- Resuelve dudas.
- Propone ejemplos.
- Adapta las explicaciones al nivel del estudiante.

**Servicio evaluador**

- Genera cuestionarios.
- Evalúa respuestas.
- Calcula resultados.
- Identifica temas que necesitan refuerzo.

**Servicio planificador**

- Consulta tareas y evaluaciones.
- Organiza sesiones.
- Distribuye contenidos.
- Propone prioridades.

**Servicio documental**

- Procesa archivos.
- Extrae texto.
- Divide documentos en fragmentos.
- Genera embeddings.
- Registra resultados.

## 9.2. Flujo de procesamiento RAG

```text
Documento del estudiante
          |
          v
     Amazon S3
          |
          v
     AWS Lambda
          |
          v
 Extracción de contenido
          |
          v
 División en fragmentos
          |
          v
 Generación de embeddings
          |
          v
 Supabase PostgreSQL
       + pgvector
          |
          v
    Búsqueda semántica
          |
          v
      Agente MINGO
          |
          v
   Modelo de inteligencia
       artificial
          |
          v
 Respuesta con referencias
          |
          v
      Angular
```

## 9.3. Herramientas del agente

El agente podrá utilizar herramientas internas mediante funciones controladas.

Ejemplos:

| Herramienta | Acción |
|---|---|
| consultar_materias | Consultar las materias del usuario |
| consultar_tareas | Buscar actividades pendientes |
| consultar_calendario | Consultar próximos eventos |
| buscar_documentos | Buscar materiales relacionados |
| generar_resumen | Crear resúmenes |
| generar_cuestionario | Crear preguntas de práctica |
| crear_plan_estudio | Proponer un plan de estudio |
| registrar_sesion | Registrar una sesión autorizada |
| consultar_progreso | Revisar el avance académico |

Las herramientas tendrán controles de autorización. El agente no podrá acceder a información de otros usuarios ni ejecutar cambios importantes sin las validaciones correspondientes.

# 10. Arquitectura general de despliegue

La infraestructura combinará Supabase con AWS.

```text
                 ESTUDIANTE
                     |
                     v
              ANGULAR FRONTEND
                     |
                     v
                API REST
             NODE.JS + EXPRESS
                     |
          +----------+----------+
          |          |          |
          v          v          v
      AUTH/JWT    SERVICES   REPOSITORIES
                     |          |
          +----------+          |
          |                     |
          v                     v
      AWS LAMBDA          SUPABASE
          |              PostgreSQL
          |              Supabase Auth
          v              pgvector
      AMAZON S3
          |
          v
   DOCUMENTOS ACADÉMICOS

          AGENTE DE IA
                |
          +-----+------+
          |            |
          v            v
       SERVICIO RAG   MODELO IA
          |
          v
     SUPABASE
      pgvector
```

La comunicación con los servicios externos se realizará desde el backend o mediante funciones serverless autorizadas.

# 11. Organización de endpoints REST

La API se organizará por módulos.

| Método | Endpoint | Función |
|---|---|---|
| GET | /api/usuarios/perfil | Consultar perfil |
| PUT | /api/usuarios/perfil | Actualizar perfil |
| GET | /api/materias | Listar materias |
| POST | /api/materias | Registrar materia |
| PUT | /api/materias/:id | Actualizar materia |
| DELETE | /api/materias/:id | Eliminar materia |
| GET | /api/tareas | Consultar tareas |
| POST | /api/tareas | Registrar tarea |
| PUT | /api/tareas/:id | Actualizar tarea |
| DELETE | /api/tareas/:id | Eliminar tarea |
| GET | /api/calendario | Consultar eventos |
| POST | /api/calendario | Registrar evento |
| POST | /api/documentos | Registrar documento |
| GET | /api/documentos | Consultar biblioteca |
| POST | /api/documentos/:id/procesar | Solicitar procesamiento |
| POST | /api/asistente/chat | Conversar con MINGO |
| POST | /api/asistente/resumen | Generar resumen |
| POST | /api/asistente/cuestionario | Generar cuestionario |
| POST | /api/asistente/plan | Crear propuesta de estudio |
| GET | /api/estudio/progreso | Consultar progreso |
| GET | /api/notificaciones | Consultar notificaciones |

Los endpoints administrativos se encontrarán separados y tendrán middleware de autorización.

# 12. Seguridad del sistema

La seguridad será una parte fundamental de MINGO.

Se implementarán:

- Autenticación mediante Supabase Auth.
- Verificación de tokens en el backend.
- Control de acceso basado en roles.
- Row Level Security en PostgreSQL.
- Validación de solicitudes mediante Zod.
- Protección de endpoints.
- Validación de formatos y tamaños de archivos.
- Buckets privados de S3.
- URLs prefirmadas para acceso temporal a documentos.
- Variables de entorno para credenciales.
- Roles IAM con privilegios mínimos.
- Registro de operaciones importantes.
- Límites de solicitudes y consumo de IA.
- Separación de datos entre estudiantes.

Las claves privadas, tokens administrativos y credenciales de servicios externos nunca estarán incluidas en el código del frontend ni en el repositorio público.

# 13. Estrategia de desarrollo y despliegue

El desarrollo se realizará progresivamente.

## Etapa 1. Preparación del proyecto

- Crear repositorio.
- Configurar Angular.
- Configurar Node.js y Express.
- Crear proyecto Supabase.
- Diseñar las primeras tablas.
- Implementar autenticación.
- Establecer la arquitectura MVC.

## Etapa 2. Desarrollo académico

- Gestión de usuarios.
- Gestión de materias.
- Gestión de tareas.
- Calendario.
- Dashboard.
- Gestión de roles.

## Etapa 3. Biblioteca documental

- Carga de archivos.
- Integración con S3.
- Registro de metadatos.
- Extracción de texto.
- Procesamiento mediante Lambda.
- Almacenamiento de fragmentos.

## Etapa 4. Inteligencia artificial

- Integración con un proveedor de IA.
- Implementación de embeddings.
- Configuración de pgvector.
- Implementación de RAG.
- Desarrollo del chat académico.
- Referencias a documentos.

## Etapa 5. Agente inteligente

- Herramientas del agente.
- Tutor académico.
- Evaluador.
- Planificador.
- Seguimiento del progreso.
- Confirmación de acciones.

## Etapa 6. Despliegue

- Desplegar frontend.
- Configurar backend y API.
- Configurar servicios AWS.
- Aplicar políticas de seguridad.
- Configurar variables de entorno.
- Ejecutar pruebas.
- Revisar consumo y costos.

# 14. Consideraciones sobre costos y capa gratuita

MINGO se desarrollará inicialmente con una estrategia de bajo costo.

Se priorizarán los planes gratuitos y las herramientas que permitan validar el funcionamiento del proyecto antes de incrementar la infraestructura.

| Servicio | Estrategia |
|---|---|
| Angular | Desarrollo local y despliegue estático |
| Node.js | Desarrollo local inicialmente |
| Supabase | Plan Free para pruebas y MVP |
| PostgreSQL | Base de datos Supabase |
| pgvector | Búsqueda vectorial dentro de PostgreSQL |
| AWS Lambda | Procesamiento serverless |
| API Gateway | Exposición de funciones |
| S3 | Almacenamiento de documentos |
| IAM | Control de permisos |
| SNS | Notificaciones cuando sean necesarias |
| Proveedor de IA | API con límites de consumo |

**Importante sobre los costos:**

- La capa gratuita de AWS no significa que todos los servicios sean gratuitos sin límites.
- Algunas cuentas nuevas tienen condiciones distintas a las cuentas antiguas.
- El almacenamiento, las solicitudes, la transferencia de datos y otros servicios pueden generar cargos.
- Las API de modelos de inteligencia artificial y generación de embeddings pueden tener costos independientes.
- Supabase también tiene límites de almacenamiento, base de datos y transferencia.
- Se configurarán presupuestos, alertas de facturación y límites de consumo cuando estén disponibles.

Para el MVP se priorizará el procesamiento de archivos pequeños, las funciones Lambda bajo demanda y una cantidad controlada de consultas a IA.

# 15. Decisiones tecnológicas definitivas

| Componente | Tecnología seleccionada |
|---|---|
| Aplicación web | Angular |
| Lenguaje frontend | TypeScript |
| Lenguaje backend | JavaScript |
| Entorno backend | Node.js |
| Framework backend | Express.js |
| Arquitectura | MVC + Services + Repositories |
| API | REST |
| Base de datos | PostgreSQL |
| Plataforma de datos | Supabase |
| Autenticación | Supabase Auth |
| Seguridad de datos | RLS + JWT + IAM |
| Almacenamiento | Amazon S3 |
| Procesamiento serverless | AWS Lambda |
| API serverless | Amazon API Gateway |
| Notificaciones | Amazon SNS |
| Búsqueda vectorial | pgvector |
| Inteligencia artificial | Modelo de lenguaje mediante API |
| Recuperación de información | RAG |
| Pruebas backend | Jest + Supertest |
| Control de versiones | Git + GitHub |

# 16. Resultado esperado

Al finalizar el desarrollo, MINGO contará con una arquitectura modular que permitirá administrar la información académica de los estudiantes y ofrecer herramientas inteligentes para mejorar su organización y aprendizaje.

La combinación de Angular, Node.js, Supabase y AWS permitirá desarrollar una plataforma web moderna, con una infraestructura flexible y preparada para incorporar nuevas funcionalidades.

El uso de MVC permitirá mantener un backend organizado y separar la lógica de negocio del acceso a datos, mientras que la incorporación de RAG y herramientas especializadas permitirá construir un agente de inteligencia artificial que trabaje con el contexto académico de cada usuario.

**MINGO no será solamente un gestor académico: será una plataforma inteligente que ayudará a cada estudiante a organizar su aprendizaje, comprender sus materiales y alcanzar sus objetivos universitarios.**