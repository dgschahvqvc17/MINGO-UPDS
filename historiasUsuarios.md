# MINGO
# HISTORIAS DE USUARIO Y PLANIFICACIÓN DE SPRINTS

**Proyecto:** MINGO – Plataforma académica inteligente  
**Metodología:** Scrum  
**Total de historias de usuario:** 18  
**Cantidad de Sprints:** 3  
**Historias por Sprint:** 6

---

# 1. Objetivo general del proyecto

Desarrollar una plataforma web académica inteligente que permita a los estudiantes universitarios organizar sus materias, tareas, evaluaciones y materiales de estudio, incorporando un agente de inteligencia artificial capaz de analizar documentos, responder consultas, generar recursos de aprendizaje y proporcionar acompañamiento académico personalizado.

# 2. Objetivos específicos

- Implementar un sistema de autenticación y administración de usuarios con control de roles.
- Desarrollar módulos para gestionar materias, actividades y calendarios académicos.
- Incorporar una biblioteca digital para almacenar y organizar materiales de estudio.
- Implementar el procesamiento inteligente de documentos mediante servicios de inteligencia artificial.
- Desarrollar un agente académico que pueda responder preguntas utilizando los materiales proporcionados por el estudiante.
- Incorporar herramientas para generar cuestionarios, evaluar conocimientos y planificar sesiones de estudio.
- Implementar mecanismos de seguimiento y notificaciones para mejorar la organización académica.

# 3. Planificación de Sprints

## Sprint 1: Plataforma base y gestión académica

**Objetivo del Sprint:**

Desarrollar la estructura inicial de MINGO, implementando el sistema de autenticación, administración de usuarios y los principales módulos de gestión académica. Al finalizar este Sprint, el estudiante podrá ingresar a la plataforma, administrar sus materias, registrar tareas y consultar sus actividades mediante un calendario académico.

**Historias de usuario:**

- HU01: Iniciar sesión en el sistema.
- HU02: Administrar usuarios y roles.
- HU03: Gestionar materias académicas.
- HU04: Gestionar tareas y actividades.
- HU05: Consultar calendario académico.
- HU06: Visualizar el panel principal académico.

**Resultado esperado:**

Una primera versión funcional de MINGO que permita a los estudiantes acceder a la plataforma y organizar su información académica desde un único entorno.

---

## Sprint 2: Biblioteca digital y procesamiento inteligente

**Objetivo del Sprint:**

Implementar la biblioteca digital de MINGO, permitiendo que los estudiantes carguen, almacenen y organicen sus documentos académicos. Además, se desarrollará el procesamiento de archivos para extraer su contenido y prepararlo para las funcionalidades de inteligencia artificial.

**Historias de usuario:**

- HU07: Cargar documentos académicos.
- HU08: Administrar biblioteca de documentos.
- HU09: Procesar documentos académicos.
- HU10: Generar resúmenes inteligentes.
- HU11: Consultar documentos mediante búsqueda semántica.
- HU12: Consultar al asistente académico mediante chat.

**Resultado esperado:**

Una biblioteca digital funcional que permita almacenar documentos, procesar su contenido, generar resúmenes y realizar consultas académicas mediante un asistente inteligente con información de los materiales del estudiante.

---

## Sprint 3: Agente inteligente y herramientas de aprendizaje

**Objetivo del Sprint:**

Desarrollar las funcionalidades avanzadas del agente de inteligencia artificial, permitiendo que MINGO acompañe al estudiante durante su proceso de aprendizaje mediante explicaciones personalizadas, generación de evaluaciones, planificación de estudios y seguimiento de sus objetivos académicos.

**Historias de usuario:**

- HU13: Generar cuestionarios y evaluaciones.
- HU14: Crear tarjetas de memoria para estudiar.
- HU15: Planificar sesiones de estudio.
- HU16: Evaluar conocimientos y proporcionar retroalimentación.
- HU17: Gestionar objetivos y progreso académico.
- HU18: Recibir notificaciones y recordatorios inteligentes.

**Resultado esperado:**

Una versión avanzada de MINGO con un agente de IA capaz de utilizar las herramientas académicas de la plataforma para ayudar al estudiante a comprender sus materiales, prepararse para evaluaciones y organizar su aprendizaje.

---

# 4. Historias de usuario

# SPRINT 1: Plataforma base y gestión académica

## HU01: Iniciar sesión en el sistema

**Como** usuario registrado, **quiero** iniciar sesión en el sistema utilizando mis credenciales para acceder a las funcionalidades correspondientes a mi rol.

**Contexto:**

El usuario posee una cuenta previamente registrada en MINGO y necesita autenticarse para acceder a su espacio académico. El sistema utiliza Supabase Auth para gestionar la autenticación y verificar la identidad de los usuarios.

**Evento:**

El usuario ingresa su correo electrónico y contraseña desde la pantalla de inicio de sesión.

**Resultado:**

El sistema valida las credenciales, verifica que la cuenta se encuentre habilitada y permite el acceso a las funcionalidades correspondientes al rol asignado.

**Requerimientos funcionales:**

- Mostrar una pantalla de inicio de sesión.
- Permitir ingresar correo electrónico y contraseña.
- Validar que los campos obligatorios estén completos.
- Validar el formato del correo electrónico.
- Autenticar al usuario mediante Supabase Auth.
- Verificar que el usuario se encuentre activo.
- Identificar el rol del usuario autenticado.
- Redirigir al usuario al panel correspondiente.
- Mostrar mensajes cuando las credenciales sean incorrectas.
- Impedir el acceso a usuarios con cuentas deshabilitadas.
- Proteger las funcionalidades que requieren autenticación.
- Permitir cerrar sesión de forma segura.

---

## HU02: Administrar usuarios y roles

**Como** administrador, **quiero** administrar los usuarios y sus roles para controlar el acceso a las funcionalidades de MINGO.

**Contexto:**

La plataforma contará con diferentes tipos de usuarios y permisos. Inicialmente se manejarán los roles de Administrador y Estudiante, por lo que es necesario disponer de un módulo que permita gestionar las cuentas y sus respectivos permisos.

**Evento:**

El administrador ingresa al módulo de administración de usuarios y selecciona una cuenta para consultar o modificar su información.

**Resultado:**

El sistema permite visualizar, administrar y controlar las cuentas de los usuarios, garantizando que cada uno tenga acceso únicamente a las funcionalidades correspondientes a su rol.

**Requerimientos funcionales:**

- Mostrar un listado de usuarios registrados.
- Permitir consultar los datos de cada usuario.
- Permitir buscar usuarios por nombre o correo electrónico.
- Permitir asignar roles a los usuarios.
- Permitir modificar el rol de una cuenta.
- Permitir activar o desactivar usuarios.
- Identificar los roles disponibles en el sistema.
- Restringir el módulo de administración a usuarios autorizados.
- Evitar que un usuario modifique sus propios privilegios.
- Registrar las operaciones administrativas importantes.
- Mostrar mensajes de confirmación al realizar cambios.

---

## HU03: Gestionar materias académicas

**Como** estudiante, **quiero** registrar y administrar mis materias académicas para organizar los contenidos y actividades correspondientes a cada asignatura.

**Contexto:**

El estudiante cursa diferentes materias durante un periodo académico y necesita mantener organizada su información. Cada materia debe funcionar como un espacio independiente donde pueda registrar actividades, documentos y recursos relacionados.

**Evento:**

El estudiante ingresa al módulo de materias y selecciona la opción para registrar una nueva asignatura o modificar una existente.

**Resultado:**

El sistema almacena la información de las materias y permite consultarlas, modificarlas y organizarlas según el periodo académico correspondiente.

**Requerimientos funcionales:**

- Mostrar el listado de materias registradas.
- Permitir registrar una nueva materia.
- Solicitar el nombre de la materia.
- Permitir registrar el código de la asignatura.
- Permitir registrar el nombre del docente.
- Permitir agregar una descripción.
- Permitir asignar un periodo académico.
- Permitir seleccionar un color identificador.
- Permitir modificar los datos de una materia.
- Permitir eliminar o archivar materias.
- Mostrar los detalles de cada materia.
- Asociar tareas y documentos con su materia correspondiente.
- Impedir que un estudiante acceda a materias pertenecientes a otro usuario.

---

## HU04: Gestionar tareas y actividades académicas

**Como** estudiante, **quiero** registrar y administrar mis tareas y actividades académicas para controlar mis responsabilidades y cumplir con las fechas de entrega.

**Contexto:**

El estudiante necesita llevar un seguimiento de trabajos, prácticas, exposiciones y otras actividades correspondientes a sus materias. Cada actividad debe contener información suficiente para identificar su importancia y fecha límite.

**Evento:**

El estudiante ingresa al módulo de tareas y selecciona la opción para registrar una nueva actividad académica.

**Resultado:**

El sistema registra la actividad y permite consultar, modificar y actualizar su estado para mantener organizado el cumplimiento de las responsabilidades académicas.

**Requerimientos funcionales:**

- Mostrar un listado de tareas registradas.
- Permitir crear nuevas tareas.
- Solicitar el título y descripción de la actividad.
- Permitir seleccionar la materia correspondiente.
- Permitir establecer una fecha de asignación.
- Permitir establecer una fecha de entrega.
- Permitir seleccionar el tipo de actividad.
- Permitir establecer niveles de prioridad.
- Permitir modificar los datos de una tarea.
- Permitir eliminar tareas.
- Permitir cambiar el estado entre pendiente, en progreso y completada.
- Mostrar las tareas próximas a vencer.
- Identificar las actividades atrasadas.
- Filtrar tareas por materia, prioridad y estado.

---

## HU05: Consultar calendario académico

**Como** estudiante, **quiero** consultar un calendario académico que reúna mis actividades y evaluaciones para visualizar las fechas importantes de mis materias.

**Contexto:**

El estudiante tiene diferentes responsabilidades distribuidas durante el periodo académico. Para facilitar su organización necesita consultar las fechas de entrega, exámenes y otras actividades desde una vista centralizada.

**Evento:**

El estudiante ingresa al módulo de calendario y selecciona el periodo que desea consultar.

**Resultado:**

El sistema muestra los eventos académicos registrados y permite identificar las actividades programadas en diferentes fechas.

**Requerimientos funcionales:**

- Mostrar un calendario académico.
- Permitir visualizar eventos por mes.
- Permitir visualizar eventos por semana.
- Permitir consultar eventos por día.
- Mostrar las fechas de entrega de tareas.
- Mostrar fechas de exámenes y evaluaciones.
- Mostrar eventos académicos personalizados.
- Diferenciar los eventos mediante colores o categorías.
- Permitir registrar nuevos eventos.
- Permitir modificar y eliminar eventos.
- Permitir consultar los detalles de cada evento.
- Relacionar eventos con materias y tareas.
- Mostrar las actividades próximas a realizarse.

---

## HU06: Visualizar el panel principal académico

**Como** estudiante, **quiero** visualizar un panel principal con un resumen de mi actividad académica para conocer rápidamente mis pendientes y organizar mis prioridades.

**Contexto:**

El estudiante necesita acceder a una vista general de su información sin tener que ingresar individualmente a cada módulo. El panel principal reunirá información de materias, tareas, evaluaciones y objetivos académicos.

**Evento:**

El estudiante inicia sesión correctamente y accede al dashboard principal de MINGO.

**Resultado:**

El sistema presenta un resumen actualizado de la información académica del estudiante, permitiéndole identificar sus actividades pendientes y acceder rápidamente a los diferentes módulos.

**Requerimientos funcionales:**

- Mostrar un mensaje de bienvenida al estudiante.
- Mostrar la cantidad de materias registradas.
- Mostrar el total de tareas pendientes.
- Mostrar las tareas completadas.
- Mostrar las actividades próximas a vencer.
- Mostrar los próximos exámenes registrados.
- Mostrar los eventos académicos más cercanos.
- Mostrar un resumen del progreso académico registrado.
- Proporcionar accesos rápidos a los módulos principales.
- Mostrar notificaciones recientes.
- Actualizar la información cuando se registren cambios.
- Presentar únicamente información correspondiente al usuario autenticado.

---

# SPRINT 2: Biblioteca digital y procesamiento inteligente

## HU07: Cargar documentos académicos

**Como** estudiante, **quiero** cargar documentos académicos a la plataforma para almacenar mis materiales de estudio y utilizarlos posteriormente con las herramientas de inteligencia artificial.

**Contexto:**

El estudiante dispone de materiales educativos en diferentes formatos, como PDF, documentos Word y presentaciones. Necesita una herramienta que le permita almacenar estos archivos y relacionarlos con sus materias.

**Evento:**

El estudiante ingresa a la biblioteca o a una materia y selecciona la opción para cargar un documento.

**Resultado:**

El sistema recibe el archivo, valida sus características, lo almacena de manera segura y registra su información para que pueda ser consultado posteriormente.

**Requerimientos funcionales:**

- Mostrar una interfaz para cargar documentos.
- Permitir seleccionar archivos desde el dispositivo.
- Admitir formatos PDF, DOCX, PPTX y TXT.
- Validar el formato del archivo.
- Validar el tamaño permitido.
- Permitir asociar el documento con una materia.
- Permitir asociar el documento con una unidad académica.
- Almacenar los archivos en Amazon S3 mediante un mecanismo seguro.
- Registrar los metadatos del documento en PostgreSQL.
- Mostrar el estado de carga del archivo.
- Mostrar mensajes cuando ocurra un error.
- Impedir la carga de archivos no permitidos.
- Asociar cada documento con el usuario propietario.

---

## HU08: Administrar biblioteca de documentos

**Como** estudiante, **quiero** administrar mis documentos académicos para mantener organizados mis materiales de estudio y acceder a ellos cuando los necesite.

**Contexto:**

El estudiante puede almacenar una gran cantidad de archivos relacionados con diferentes materias. Por ello, necesita una biblioteca digital que permita consultar, clasificar y gestionar los documentos registrados.

**Evento:**

El estudiante ingresa al módulo de biblioteca y selecciona un documento para visualizar sus detalles o realizar alguna operación.

**Resultado:**

El sistema muestra los documentos almacenados y permite organizarlos, consultarlos, descargarlos o eliminarlos según los permisos del usuario.

**Requerimientos funcionales:**

- Mostrar los documentos registrados.
- Permitir visualizar los detalles de cada documento.
- Mostrar el nombre del archivo.
- Mostrar el formato del documento.
- Mostrar la fecha de carga.
- Mostrar la materia relacionada.
- Permitir filtrar documentos por materia.
- Permitir buscar documentos por nombre.
- Permitir descargar archivos autorizados.
- Permitir eliminar documentos.
- Mostrar el estado de procesamiento de cada archivo.
- Permitir consultar documentos procesados.
- Mantener separados los documentos de cada estudiante.

---

## HU09: Procesar documentos académicos

**Como** estudiante, **quiero** que MINGO procese automáticamente mis documentos académicos para convertir su contenido en información que pueda utilizar el asistente inteligente.

**Contexto:**

Los documentos cargados en la biblioteca contienen información educativa que debe ser extraída y preparada antes de utilizarse en consultas de inteligencia artificial. El sistema utilizará procesos de backend y servicios serverless para realizar esta operación.

**Evento:**

El estudiante carga un documento o solicita procesar uno que todavía no ha sido analizado.

**Resultado:**

El sistema procesa el archivo, extrae su contenido, lo divide en fragmentos y almacena la información necesaria para realizar consultas posteriores mediante búsqueda semántica.

**Requerimientos funcionales:**

- Detectar documentos pendientes de procesamiento.
- Recuperar el archivo almacenado en Amazon S3.
- Ejecutar el procesamiento mediante AWS Lambda.
- Extraer el texto de los documentos compatibles.
- Identificar las páginas cuando el formato lo permita.
- Dividir el contenido en fragmentos.
- Generar embeddings de los fragmentos mediante un proveedor de IA.
- Almacenar los fragmentos en PostgreSQL.
- Almacenar los embeddings mediante pgvector.
- Relacionar cada fragmento con su documento original.
- Registrar el estado del procesamiento.
- Mostrar mensajes cuando el procesamiento finalice.
- Gestionar errores durante la extracción de contenido.
- Evitar procesar nuevamente documentos sin necesidad.

---

## HU10: Generar resúmenes inteligentes

**Como** estudiante, **quiero** generar resúmenes de mis documentos académicos mediante inteligencia artificial para comprender rápidamente los contenidos más importantes.

**Contexto:**

Los materiales académicos pueden contener información extensa que requiere tiempo para ser revisada. El estudiante necesita una herramienta que permita obtener resúmenes organizados sin tener que leer inicialmente todo el documento.

**Evento:**

El estudiante selecciona un documento procesado y solicita generar un resumen mediante MINGO.

**Resultado:**

El sistema analiza el contenido del documento y genera un resumen estructurado con los conceptos y temas más importantes.

**Requerimientos funcionales:**

- Permitir seleccionar un documento para resumir.
- Verificar que el documento haya sido procesado.
- Recuperar el contenido del documento.
- Enviar el contenido al servicio de inteligencia artificial.
- Generar un resumen general.
- Identificar los temas principales.
- Identificar conceptos importantes.
- Presentar el resumen de manera organizada.
- Permitir seleccionar un nivel de profundidad del resumen.
- Mostrar el documento de origen.
- Permitir consultar nuevamente el resumen generado.
- Mostrar mensajes cuando no sea posible generar el resumen.

---

## HU11: Consultar documentos mediante búsqueda semántica

**Como** estudiante, **quiero** realizar búsquedas inteligentes dentro de mis documentos para encontrar información relacionada con un tema sin tener que revisar manualmente cada archivo.

**Contexto:**

El estudiante almacena documentos que contienen diferentes conceptos y explicaciones. Una búsqueda tradicional por palabras exactas puede no encontrar información relacionada cuando se utilizan términos diferentes.

Por ello, MINGO utilizará embeddings y búsqueda semántica mediante pgvector para recuperar fragmentos relacionados con la consulta.

**Evento:**

El estudiante introduce una pregunta o concepto en el buscador inteligente de la biblioteca.

**Resultado:**

El sistema recupera los fragmentos de documentos que presentan mayor relación semántica con la consulta y muestra sus referencias para facilitar su revisión.

**Requerimientos funcionales:**

- Mostrar un buscador inteligente.
- Permitir ingresar preguntas o conceptos.
- Generar un embedding de la consulta.
- Buscar fragmentos relacionados mediante pgvector.
- Limitar la búsqueda a los documentos autorizados del estudiante.
- Ordenar los resultados según su relevancia.
- Mostrar el contenido de los fragmentos encontrados.
- Identificar el documento de origen.
- Mostrar el número de página cuando esté disponible.
- Permitir abrir el documento relacionado.
- Mostrar un mensaje cuando no existan resultados relevantes.

---

## HU12: Consultar al asistente académico mediante chat

**Como** estudiante, **quiero** conversar con el agente de inteligencia artificial MINGO para realizar preguntas y recibir explicaciones basadas en mis materiales académicos.

**Contexto:**

El estudiante necesita un asistente que pueda responder dudas sobre sus materias y documentos. El agente utilizará un modelo de lenguaje y un sistema RAG para recuperar información relevante antes de generar sus respuestas.

**Evento:**

El estudiante ingresa al módulo de asistente académico, escribe una pregunta y envía el mensaje.

**Resultado:**

El agente interpreta la consulta, recupera información relevante de los documentos autorizados y genera una respuesta contextualizada que puede incluir referencias a los materiales utilizados.

**Requerimientos funcionales:**

- Mostrar una interfaz de chat académico.
- Permitir enviar mensajes al agente.
- Permitir iniciar nuevas conversaciones.
- Mantener el historial de conversaciones.
- Identificar la intención de la consulta.
- Consultar documentos relacionados mediante RAG.
- Enviar el contexto recuperado al modelo de IA.
- Generar respuestas en lenguaje natural.
- Mostrar referencias de los documentos utilizados.
- Identificar páginas cuando estén disponibles.
- Permitir realizar preguntas de seguimiento.
- Permitir consultar conversaciones anteriores.
- Indicar cuando no exista información suficiente en los documentos.
- Mantener las conversaciones separadas por usuario.

---

# SPRINT 3: Agente inteligente y herramientas de aprendizaje

## HU13: Generar cuestionarios y evaluaciones

**Como** estudiante, **quiero** generar cuestionarios mediante inteligencia artificial a partir de mis materiales académicos para practicar y evaluar mis conocimientos.

**Contexto:**

El estudiante necesita prepararse para sus evaluaciones y practicar los contenidos estudiados. Elaborar preguntas manualmente requiere tiempo, por lo que MINGO permitirá generar cuestionarios utilizando documentos y temas seleccionados.

**Evento:**

El estudiante selecciona una materia o documento y solicita generar un cuestionario.

**Resultado:**

El sistema genera una evaluación con preguntas relacionadas con el contenido seleccionado y permite que el estudiante responda para comprobar sus conocimientos.

**Requerimientos funcionales:**

- Permitir seleccionar una materia.
- Permitir seleccionar un documento o unidad.
- Permitir indicar la cantidad de preguntas.
- Permitir seleccionar el nivel de dificultad.
- Permitir elegir el tipo de preguntas.
- Generar preguntas mediante inteligencia artificial.
- Permitir preguntas de opción múltiple.
- Permitir preguntas de verdadero o falso.
- Permitir preguntas abiertas.
- Generar alternativas cuando corresponda.
- Almacenar los cuestionarios generados.
- Permitir iniciar una evaluación.
- Mostrar las preguntas de forma organizada.
- Registrar las respuestas del estudiante.

---

## HU14: Crear tarjetas de memoria para estudiar

**Como** estudiante, **quiero** generar tarjetas de memoria a partir de mis materiales académicos para repasar conceptos y mejorar la retención de información.

**Contexto:**

El estudiante necesita repasar conceptos importantes de sus materias de manera práctica. Las tarjetas de memoria permiten estudiar mediante preguntas y respuestas cortas, facilitando la repetición y el aprendizaje.

**Evento:**

El estudiante selecciona un documento o tema y solicita generar tarjetas de memoria.

**Resultado:**

El sistema genera tarjetas con preguntas y respuestas relacionadas con el contenido seleccionado, permitiendo al estudiante practicar y revisar sus conocimientos.

**Requerimientos funcionales:**

- Permitir seleccionar una materia.
- Permitir seleccionar un documento.
- Permitir indicar la cantidad de tarjetas.
- Generar preguntas y respuestas mediante IA.
- Mostrar el frente de cada tarjeta.
- Permitir revelar la respuesta.
- Permitir avanzar y retroceder entre tarjetas.
- Permitir marcar tarjetas como conocidas.
- Permitir marcar tarjetas que necesitan repaso.
- Permitir repetir las tarjetas pendientes.
- Guardar las tarjetas generadas.
- Permitir consultar conjuntos de tarjetas anteriores.

---

## HU15: Planificar sesiones de estudio

**Como** estudiante, **quiero** crear planes de estudio personalizados mediante MINGO para distribuir mis actividades y prepararme de manera organizada para mis evaluaciones.

**Contexto:**

El estudiante tiene diferentes materias, documentos y evaluaciones que requieren preparación. Necesita una herramienta que considere sus fechas importantes y disponibilidad para proponer una planificación realista.

**Evento:**

El estudiante solicita crear un plan de estudio e indica la materia, el objetivo, la fecha de evaluación y el tiempo disponible para estudiar.

**Resultado:**

El agente analiza la información académica y propone un plan organizado en sesiones, distribuyendo los temas y actividades durante el periodo disponible.

**Requerimientos funcionales:**

- Permitir seleccionar una materia.
- Permitir establecer un objetivo de estudio.
- Permitir registrar la fecha de una evaluación.
- Permitir indicar el tiempo disponible por día.
- Consultar las tareas y evaluaciones relacionadas.
- Consultar los documentos de la materia.
- Identificar los temas que deben estudiarse.
- Generar una planificación mediante IA.
- Distribuir los temas en diferentes sesiones.
- Establecer una duración para cada sesión.
- Mostrar las sesiones en un calendario.
- Permitir modificar el plan generado.
- Permitir aceptar o descartar la propuesta.
- Registrar las sesiones confirmadas.

---

## HU16: Evaluar conocimientos y proporcionar retroalimentación

**Como** estudiante, **quiero** que MINGO evalúe mis respuestas y me proporcione retroalimentación para identificar mis errores y mejorar mi comprensión de los temas estudiados.

**Contexto:**

Después de realizar cuestionarios y actividades de práctica, el estudiante necesita conocer sus resultados y comprender los errores cometidos. La plataforma utilizará mecanismos de evaluación automática y asistencia de inteligencia artificial cuando corresponda.

**Evento:**

El estudiante finaliza un cuestionario o responde una actividad de evaluación.

**Resultado:**

El sistema evalúa las respuestas, calcula los resultados y presenta explicaciones que permiten identificar los temas que necesitan mayor atención.

**Requerimientos funcionales:**

- Registrar las respuestas del estudiante.
- Comparar respuestas con las soluciones definidas.
- Evaluar automáticamente preguntas objetivas.
- Utilizar IA para evaluar respuestas abiertas con criterios definidos.
- Calcular una puntuación.
- Mostrar las respuestas correctas e incorrectas.
- Explicar los errores cometidos.
- Identificar los temas con menor dominio.
- Mostrar el resultado de la evaluación.
- Guardar el historial de intentos.
- Permitir revisar evaluaciones anteriores.
- Generar recomendaciones de repaso.

---

## HU17: Gestionar objetivos y progreso académico

**Como** estudiante, **quiero** registrar mis objetivos académicos y consultar mi progreso para conocer mis avances y mantener un seguimiento de mis actividades de aprendizaje.

**Contexto:**

El estudiante necesita establecer objetivos relacionados con sus materias y sesiones de estudio. Además, requiere conocer el nivel de cumplimiento de sus actividades para identificar qué aspectos necesita mejorar.

**Evento:**

El estudiante ingresa al módulo de progreso y registra un objetivo académico o consulta sus estadísticas.

**Resultado:**

El sistema permite administrar los objetivos y muestra información sobre las actividades realizadas, sesiones completadas y resultados obtenidos.

**Requerimientos funcionales:**

- Permitir registrar objetivos académicos.
- Permitir asociar objetivos con materias.
- Permitir establecer fechas límite.
- Permitir modificar objetivos.
- Permitir actualizar su estado.
- Mostrar objetivos pendientes y completados.
- Mostrar sesiones de estudio realizadas.
- Mostrar cuestionarios completados.
- Mostrar resultados obtenidos.
- Calcular porcentajes de cumplimiento.
- Mostrar estadísticas mediante gráficos.
- Identificar actividades que necesitan atención.
- Proporcionar recomendaciones basadas en los registros disponibles.

---

## HU18: Recibir notificaciones y recordatorios inteligentes

**Como** estudiante, **quiero** recibir notificaciones y recordatorios sobre mis actividades académicas para evitar olvidar tareas, evaluaciones y sesiones de estudio importantes.

**Contexto:**

El estudiante tiene diferentes responsabilidades y necesita recibir avisos oportunos sobre sus fechas de entrega, evaluaciones y actividades planificadas. MINGO utilizará la información del calendario y los servicios de notificaciones para mantenerlo informado.

**Evento:**

Se aproxima la fecha de una actividad, se programa una sesión de estudio o se genera un recordatorio configurado por el estudiante.

**Resultado:**

El sistema genera y envía una notificación al estudiante, permitiéndole conocer la actividad pendiente y acceder a sus detalles.

**Requerimientos funcionales:**

- Generar notificaciones para tareas próximas a vencer.
- Generar recordatorios de evaluaciones.
- Generar avisos de sesiones de estudio.
- Permitir configurar anticipación de recordatorios.
- Permitir activar o desactivar notificaciones.
- Mostrar notificaciones dentro de la plataforma.
- Identificar notificaciones leídas y no leídas.
- Permitir consultar el historial de notificaciones.
- Relacionar las notificaciones con sus actividades correspondientes.
- Programar notificaciones mediante procesos automáticos.
- Utilizar AWS Lambda para ejecutar procesos programados cuando corresponda.
- Incorporar Amazon SNS para los canales de notificación que se habiliten.
- Evitar el envío repetido de una misma notificación.

---

# 5. Resumen general de los Sprints

| Sprint | Historias | Enfoque | Resultado |
|---|---:|---|---|
| Sprint 1 | HU01–HU06 | Plataforma y gestión académica | Sistema base funcional |
| Sprint 2 | HU07–HU12 | Documentos e IA | Biblioteca inteligente y chat RAG |
| Sprint 3 | HU13–HU18 | Aprendizaje inteligente | Agente académico y herramientas de estudio |

# 6. Resultado esperado de cada Sprint

**Sprint 1:**

Se contará con una plataforma funcional que permitirá registrar usuarios, gestionar roles, administrar materias, controlar tareas y consultar el calendario académico desde un dashboard centralizado.

**Sprint 2:**

Se incorporará una biblioteca digital con almacenamiento seguro y procesamiento de documentos. Los estudiantes podrán generar resúmenes, realizar búsquedas semánticas y consultar sus materiales mediante un chat académico basado en RAG.

**Sprint 3:**

Se implementarán herramientas avanzadas del agente inteligente, incluyendo generación de cuestionarios, tarjetas de memoria, planificación de estudios, evaluación de conocimientos, seguimiento académico y notificaciones.

# 7. Consideraciones generales

- Todas las historias de usuario deberán implementarse respetando los roles y permisos definidos.
- Cada estudiante solamente podrá consultar y modificar su propia información académica.
- El administrador tendrá acceso a las funciones administrativas, pero no tendrá acceso automático al contenido privado de los estudiantes.
- El procesamiento de documentos deberá realizarse mediante servicios controlados y seguros.
- El agente de inteligencia artificial deberá utilizar información autorizada y proporcionar referencias cuando responda con base en documentos.
- Las operaciones que modifiquen información académica deberán contar con las validaciones correspondientes.
- Las funcionalidades de inteligencia artificial deberán controlar el consumo de servicios externos.
- Cada historia deberá contar con pruebas funcionales antes de considerarse terminada.

---

**Fin del documento – Historias de usuario de MINGO.**