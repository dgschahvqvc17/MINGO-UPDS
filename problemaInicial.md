# MINGO
## Plataforma académica inteligente con un agente de inteligencia artificial

**Documento de contexto del proyecto**

---

# 1. Descripción general

MINGO es una plataforma web académica inteligente diseñada para ayudar a los estudiantes universitarios a organizar, administrar y mejorar su proceso de aprendizaje mediante herramientas de gestión académica e inteligencia artificial.

La plataforma nace con la intención de ofrecer una experiencia complementaria a los entornos virtuales de aprendizaje tradicionales, como Moodle, que son utilizados por las universidades para publicar materiales educativos, gestionar actividades, recibir tareas y comunicar información académica.

MINGO no pretende reemplazar Moodle ni convertirse en otra plataforma donde los docentes deban publicar sus contenidos. Su propósito es funcionar como un asistente académico personal que permita al estudiante centralizar su información, organizar sus responsabilidades y aprovechar sus materiales de estudio de una manera más inteligente.

La característica principal de MINGO será la incorporación de un agente de inteligencia artificial capaz de comprender el contexto académico de cada estudiante, analizar sus documentos, responder preguntas, generar recursos de aprendizaje, planificar sesiones de estudio y ayudarlo a cumplir sus objetivos académicos.

# 2. Contexto y problemática

Actualmente, muchas universidades utilizan plataformas virtuales como Moodle para complementar sus actividades académicas presenciales. En estos entornos, los estudiantes pueden consultar sus materias, revisar los recursos proporcionados por los docentes, visualizar actividades, entregar trabajos y conocer las fechas de evaluaciones.

Sin embargo, aunque estas plataformas cumplen con su función de administración del aprendizaje, el estudiante todavía debe encargarse de organizar gran parte de su información y gestionar individualmente sus responsabilidades.

En la práctica, la información académica suele encontrarse distribuida entre diferentes materias, documentos PDF, presentaciones, avisos, actividades, calendarios y otros recursos. Esto puede dificultar el seguimiento de las responsabilidades y la preparación adecuada para evaluaciones.

Entre los principales problemas identificados se encuentran:

### 2.1. Información académica dispersa

Los estudiantes deben ingresar constantemente a diferentes materias para revisar si existen nuevas actividades, materiales, avisos o modificaciones en las fechas de entrega.

No siempre disponen de una vista centralizada que les permita comprender rápidamente qué actividades tienen pendientes y cuáles requieren mayor atención.

### 2.2. Dificultad para organizar tareas y evaluaciones

La administración de las actividades académicas depende en gran medida de la organización personal del estudiante.

Cuando existen varias materias, trabajos y evaluaciones simultáneas, puede resultar complicado determinar prioridades, distribuir el tiempo y cumplir con todas las fechas establecidas.

### 2.3. Materiales de estudio poco aprovechados

Los docentes proporcionan diferentes recursos educativos, como documentos PDF, presentaciones, archivos Word y otros materiales.

Sin embargo, los estudiantes deben revisar estos documentos manualmente para identificar los conceptos importantes, comprender los temas y preparar sus evaluaciones.

Esto puede consumir bastante tiempo, especialmente cuando existen documentos extensos o numerosos materiales de una misma materia.

### 2.4. Falta de acompañamiento académico personalizado

Las plataformas tradicionales permiten consultar información y acceder a recursos, pero no necesariamente ofrecen un acompañamiento inteligente que comprenda las necesidades particulares de cada estudiante.

Por ejemplo, un estudiante puede necesitar una explicación más sencilla de un concepto, preguntas para practicar, una evaluación de sus conocimientos o un plan de estudio basado en el tiempo disponible.

### 2.5. Preparación de evaluaciones poco organizada

Muchos estudiantes comienzan a estudiar cuando se aproxima una evaluación, sin contar con una planificación que distribuya los contenidos y permita identificar los temas que todavía no comprenden.

Además, elaborar cuestionarios, tarjetas de memoria o simulacros de examen manualmente requiere tiempo adicional.

### 2.6. Ausencia de seguimiento inteligente del progreso

El estudiante necesita conocer cómo está avanzando en sus materias, qué actividades ha completado, cuáles tiene pendientes y qué temas necesita reforzar.

Sin herramientas de seguimiento y análisis, esta información puede quedar dispersa y dificultar la identificación de hábitos de estudio que necesitan mejorar.

# 3. Problema específico relacionado con Moodle de la UPDS

Uno de los puntos de partida del proyecto es la plataforma virtual Moodle utilizada por la Universidad Privada Domingo Savio (UPDS).

Se identificó que el acceso a determinadas funcionalidades administrativas y a la configuración de servicios web está restringido para las cuentas de estudiantes.

Durante las pruebas iniciales se intentó acceder a las rutas administrativas de Moodle relacionadas con los servicios web, obteniendo respuestas de acceso denegado (HTTP 403).

Esto representa una limitación para implementar una integración directa mediante la API oficial, ya que su habilitación y configuración dependen de los administradores de la institución.

Por este motivo, MINGO se diseñará como una plataforma independiente de Moodle, sin depender de permisos administrativos ni de una integración institucional obligatoria.

La información académica podrá incorporarse mediante registro manual, carga de documentos e importación de información obtenida por el propio estudiante. En una etapa posterior, se podrá desarrollar una extensión de navegador que facilite la recopilación de información visible en Moodle, siempre respetando los permisos y mecanismos de seguridad de la plataforma.

Si en el futuro la universidad habilita servicios web oficiales, MINGO podrá incorporar una integración autorizada.

# 4. Solución propuesta

Se propone desarrollar MINGO, una plataforma web académica que centralice la información de cada estudiante y utilice inteligencia artificial para convertir sus materiales y actividades en una experiencia de aprendizaje más organizada, personalizada e interactiva.

La plataforma permitirá registrar materias, administrar tareas, establecer fechas de entrega, organizar calendarios, almacenar documentos y consultar información académica desde un único entorno.

Su principal diferenciador será un agente de inteligencia artificial que no se limitará a responder preguntas, sino que podrá utilizar el contexto académico del estudiante para realizar diferentes actividades de apoyo.

Por ejemplo, si un estudiante tiene un examen de programación dentro de cinco días y ha cargado tres documentos de estudio, podrá solicitarle a MINGO que analice los materiales, identifique los temas principales, organice un plan de preparación y genere preguntas para evaluar sus conocimientos.

De esta manera, MINGO busca pasar de un modelo donde el estudiante solamente consulta información a uno donde cuenta con un asistente que lo acompaña activamente en su proceso de aprendizaje.

# 5. Objetivo general

Desarrollar una plataforma web académica inteligente denominada MINGO, que permita centralizar y administrar la información académica de los estudiantes universitarios mediante herramientas de organización, gestión documental e inteligencia artificial, incorporando un agente inteligente capaz de analizar materiales educativos, responder consultas, generar recursos de aprendizaje y ofrecer acompañamiento personalizado.

# 6. Objetivos específicos

- Implementar un sistema de autenticación y administración de perfiles de estudiantes.
- Desarrollar un módulo para registrar y administrar materias, docentes y contenidos académicos.
- Implementar herramientas para gestionar tareas, actividades, evaluaciones y fechas de entrega.
- Desarrollar un calendario académico centralizado.
- Incorporar una biblioteca digital para almacenar y clasificar documentos de estudio.
- Implementar mecanismos de procesamiento y análisis de documentos mediante inteligencia artificial.
- Desarrollar un agente académico capaz de responder preguntas utilizando información de los materiales proporcionados por el estudiante.
- Incorporar funcionalidades para generar resúmenes, cuestionarios, simulacros y tarjetas de memoria.
- Implementar herramientas de planificación y seguimiento de sesiones de estudio.
- Incorporar notificaciones y recordatorios relacionados con las responsabilidades académicas.
- Desarrollar una arquitectura escalable que permita incorporar nuevas funcionalidades e integraciones en el futuro.

# 7. Funcionalidades principales de MINGO

## 7.1. Panel principal (Dashboard)

Será la pantalla inicial de la plataforma y ofrecerá una vista general del estado académico del estudiante.

Incluirá:

- Resumen de materias registradas.
- Tareas pendientes y completadas.
- Próximas fechas de entrega.
- Próximos exámenes.
- Actividades prioritarias.
- Progreso de los objetivos de estudio.
- Acceso rápido al agente MINGO.
- Notificaciones recientes.

El objetivo es que el estudiante pueda identificar rápidamente qué necesita hacer y cómo se encuentra su organización académica.

## 7.2. Gestión de materias

Permitirá registrar y administrar las materias que cursa el estudiante durante un periodo académico.

Cada materia podrá incluir:

- Nombre de la materia.
- Código o identificador.
- Docente responsable.
- Periodo académico.
- Descripción.
- Horarios.
- Temas o unidades.
- Actividades asociadas.
- Documentos y recursos educativos.

Cada materia tendrá un espacio independiente donde se organizará toda su información.

## 7.3. Gestión de tareas y evaluaciones

Permitirá registrar actividades académicas y realizar un seguimiento de su cumplimiento.

Cada actividad podrá contener:

- Título.
- Descripción.
- Materia relacionada.
- Fecha de asignación.
- Fecha límite.
- Nivel de prioridad.
- Estado: pendiente, en progreso o completada.
- Archivos relacionados.
- Observaciones personales.

También permitirá visualizar las actividades mediante diferentes vistas, como listas, calendario y tareas prioritarias.

## 7.4. Calendario académico

Centralizará las fechas importantes del estudiante.

Permitirá visualizar:

- Entregas de trabajos.
- Exámenes.
- Exposiciones.
- Prácticas.
- Eventos académicos.
- Sesiones de estudio planificadas.

El calendario permitirá identificar periodos con mayor carga académica y facilitará la planificación anticipada.

## 7.5. Biblioteca inteligente

Será el espacio donde el estudiante podrá almacenar sus materiales de estudio.

Se admitirán formatos como:

- PDF.
- DOCX.
- PPTX.
- TXT.

Los documentos estarán organizados por materia, unidad o categoría.

La biblioteca permitirá consultar los materiales, visualizar información básica de cada archivo y enviarlos al agente de inteligencia artificial para su procesamiento.

## 7.6. Centro de estudio

Será un módulo dedicado a la preparación y práctica de contenidos académicos.

Incluirá:

- Generación de cuestionarios.
- Tarjetas de memoria (flashcards).
- Simulacros de exámenes.
- Preguntas de opción múltiple.
- Preguntas de verdadero o falso.
- Preguntas abiertas.
- Evaluación automática de respuestas.
- Identificación de temas que necesitan refuerzo.

Los recursos podrán generarse a partir de los documentos cargados por el estudiante.

## 7.7. Notificaciones y recordatorios

Permitirá mantener informado al estudiante sobre sus responsabilidades.

Se podrán generar notificaciones relacionadas con:

- Fechas próximas de entrega.
- Exámenes programados.
- Actividades pendientes.
- Sesiones de estudio.
- Objetivos académicos.
- Recordatorios personalizados.

En etapas posteriores se podrán incorporar notificaciones push y otros canales de comunicación.

# 8. Agente de inteligencia artificial MINGO

El agente de inteligencia artificial será el componente más importante y diferenciador de la plataforma.

No se plantea como un chatbot genérico, sino como un asistente académico que tendrá acceso controlado al contexto y a la información del estudiante.

Su función será comprender las solicitudes, consultar los recursos disponibles, seleccionar las herramientas necesarias y entregar resultados útiles para el aprendizaje.

## 8.1. Chat académico inteligente

El estudiante podrá conversar con MINGO mediante lenguaje natural.

Algunos ejemplos de preguntas serán:

- Explícame este tema como si fuera principiante.
- ¿Cuáles son los conceptos más importantes de este documento?
- ¿Qué diferencia existe entre estos dos conceptos?
- Hazme preguntas sobre la unidad 3.
- Explícame este ejercicio paso a paso.
- ¿Qué temas debería estudiar para mi próximo examen?

El agente deberá utilizar los materiales disponibles del estudiante cuando la consulta esté relacionada con ellos.

Cuando no encuentre información suficiente, deberá indicarlo claramente en lugar de inventar respuestas.

## 8.2. Análisis inteligente de documentos

Cuando el estudiante cargue un documento, MINGO podrá procesarlo para identificar su contenido y convertirlo en información útil.

El procesamiento incluirá:

1. Recepción y almacenamiento del documento.
2. Extracción del texto.
3. División del contenido en fragmentos.
4. Identificación de conceptos y temas relevantes.
5. Generación de embeddings para búsqueda semántica.
6. Almacenamiento de los fragmentos y sus referencias.
7. Disponibilidad del documento para consultas del agente.

A partir de este proceso se podrán generar resúmenes, explicaciones, preguntas y recursos de estudio.

## 8.3. Sistema RAG (Retrieval-Augmented Generation)

Para que MINGO pueda responder utilizando los materiales académicos del estudiante, se implementará un sistema RAG.

Este mecanismo permitirá recuperar fragmentos relevantes de los documentos antes de generar una respuesta mediante un modelo de inteligencia artificial.

El funcionamiento será el siguiente:

1. El estudiante realiza una pregunta.
2. El sistema identifica el contexto de la consulta.
3. Se realiza una búsqueda semántica en los documentos del estudiante.
4. Se recuperan los fragmentos relacionados con la pregunta.
5. Se envían los fragmentos y la consulta al modelo de IA.
6. El modelo genera una respuesta contextualizada.
7. MINGO presenta la explicación junto con las referencias disponibles al documento y página correspondiente.

De esta manera, el agente podrá responder preguntas basándose en los materiales proporcionados y reducir las respuestas que no estén respaldadas por las fuentes.

## 8.4. Agente planificador de estudios

Este componente permitirá crear planes de estudio personalizados.

El estudiante podrá indicar:

- Materia que desea preparar.
- Fecha de su examen.
- Temas que necesita estudiar.
- Tiempo disponible por día.
- Nivel de conocimiento.
- Objetivo que desea alcanzar.

Con esta información, MINGO podrá distribuir los contenidos en sesiones de estudio, establecer prioridades y proponer actividades para cada jornada.

El estudiante podrá modificar el plan y marcar sus sesiones como completadas.

## 8.5. Agente tutor

Funcionará como un tutor personalizado que ayudará a comprender los contenidos académicos.

Podrá:

- Explicar conceptos difíciles.
- Proporcionar ejemplos prácticos.
- Resolver dudas paso a paso.
- Comparar conceptos.
- Proponer ejercicios.
- Evaluar respuestas.
- Identificar errores de comprensión.
- Recomendar contenidos que necesitan repasarse.

El agente deberá adaptar la complejidad de las explicaciones al nivel indicado por el estudiante.

## 8.6. Agente evaluador

Permitirá generar evaluaciones basadas en los documentos de estudio.

El estudiante podrá seleccionar una materia, un documento o una unidad y solicitar un examen de práctica.

El sistema podrá:

- Generar preguntas.
- Presentar alternativas de respuesta.
- Evaluar respuestas.
- Calcular una puntuación.
- Explicar los errores.
- Identificar los temas con menor dominio.
- Recomendar nuevos ejercicios.

## 8.7. Agente de seguimiento académico

MINGO podrá utilizar los registros de actividades y sesiones de estudio para ofrecer recomendaciones.

Por ejemplo:

- Identificar tareas que están próximas a vencer.
- Detectar materias con actividades acumuladas.
- Mostrar objetivos de estudio incumplidos.
- Recomendar sesiones de repaso.
- Identificar temas que el estudiante suele responder incorrectamente.

Estas recomendaciones se basarán en la información disponible, sin asumir que los registros de la plataforma representan necesariamente todo el rendimiento académico del estudiante.

## 8.8. Uso de herramientas por parte del agente

Una característica importante será permitir que el agente utilice herramientas internas de MINGO.

Por ejemplo, cuando el estudiante escriba:

"Organiza mi estudio para el examen de programación del viernes".

El agente podrá:

1. Consultar las materias registradas.
2. Buscar el examen en el calendario.
3. Consultar los documentos relacionados.
4. Recuperar los temas de estudio.
5. Revisar el tiempo disponible.
6. Proponer un plan.
7. Solicitar confirmación antes de guardar cambios importantes.
8. Registrar las sesiones de estudio una vez autorizadas.

Esto permitirá que MINGO no solamente genere texto, sino que pueda interactuar con las funcionalidades reales de la plataforma mediante herramientas controladas.

# 9. Ejemplo de funcionamiento del agente

**Situación:**

Un estudiante tiene un examen de programación dentro de cinco días y ha cargado tres documentos PDF correspondientes a su materia.

**Interacción:**

Estudiante:

"Tengo examen de programación el viernes y todavía no estudié. Tengo tres documentos, ayúdame a prepararme".

MINGO:

"¡Vamos a organizar tu preparación! Primero revisaré tus documentos para identificar los temas principales y distribuirlos en los próximos cinco días".

**Acciones del agente:**

1. Consulta el examen registrado.
2. Analiza los tres documentos.
3. Identifica las unidades y conceptos importantes.
4. Organiza los temas según su extensión y complejidad.
5. Propone un calendario de sesiones.
6. Genera preguntas de práctica.
7. Evalúa los resultados del estudiante.
8. Recomienda reforzar los temas con menor puntuación.

**Resultado esperado:**

El estudiante obtiene un plan de preparación organizado, materiales de práctica y acompañamiento durante su proceso de estudio.

# 10. Arquitectura tecnológica propuesta

MINGO utilizará una arquitectura basada en tecnologías web y servicios cloud, combinando Supabase y AWS.

### Frontend

- Angular.
- TypeScript.
- HTML5.
- CSS3.
- Bootstrap o una solución de componentes propia.

Responsabilidades:

- Interfaz de usuario.
- Dashboard académico.
- Gestión de materias.
- Calendario.
- Biblioteca.
- Centro de estudio.
- Interfaz conversacional del agente.

### Backend

- Node.js.
- JavaScript.
- Express.js.
- Arquitectura MVC.
- API REST.
- Validación de datos.
- Middleware de autenticación y autorización.

La estructura se organizará en modelos, controladores, servicios y repositorios, manteniendo separadas las responsabilidades.

### Supabase

Se utilizará para:

- Autenticación de usuarios.
- Base de datos PostgreSQL.
- Almacenamiento de información académica.
- Gestión de relaciones entre usuarios, materias, tareas y documentos.
- Búsqueda vectorial mediante pgvector para implementar RAG.

### AWS

Se incorporarán servicios de AWS de acuerdo con las necesidades del proyecto:

- **Amazon S3:** almacenamiento de documentos y archivos.
- **AWS Lambda:** ejecución de procesos de manera serverless.
- **Amazon API Gateway:** exposición de endpoints para servicios serverless.
- **AWS IAM:** control de permisos y acceso entre servicios.
- **Amazon SNS:** envío de notificaciones cuando corresponda.

La implementación deberá considerar los límites de uso, costos y condiciones vigentes de cada servicio, especialmente al trabajar con la capa gratuita.

### Inteligencia artificial

Se integrará un modelo de lenguaje mediante una API de IA.

Se utilizará para:

- Comprensión de consultas.
- Generación de resúmenes.
- Explicaciones académicas.
- Generación de preguntas.
- Evaluación de respuestas.
- Planificación de estudios.
- Interacción con herramientas de la plataforma.

La integración se realizará desde el backend para proteger las claves y controlar el consumo.

# 11. Módulos generales del sistema

La plataforma estará organizada en los siguientes módulos:

1. Autenticación y perfiles.
2. Dashboard académico.
3. Gestión de materias.
4. Gestión de tareas y actividades.
5. Calendario académico.
6. Biblioteca documental.
7. Procesamiento inteligente de documentos.
8. Chat académico.
9. Agente tutor.
10. Agente planificador.
11. Agente evaluador.
12. Centro de estudio.
13. Notificaciones y recordatorios.
14. Seguimiento del progreso.
15. Configuración del perfil y preferencias.

# 12. Seguridad y privacidad

La información académica de cada estudiante deberá mantenerse aislada y protegida.

Se implementarán mecanismos como:

- Autenticación segura.
- Autorización basada en usuarios.
- Políticas de acceso a datos.
- Separación de documentos por propietario.
- Protección de archivos almacenados.
- Validación de archivos cargados.
- Control de acceso a las herramientas del agente.
- Protección de credenciales y claves de servicios externos.

El agente de IA solamente podrá consultar la información para la cual el estudiante tenga autorización.

No se utilizarán credenciales de Moodle ni se intentará evadir los mecanismos de autenticación o permisos de la UPDS.

# 13. Alcance y etapas de desarrollo

El desarrollo de MINGO se realizará progresivamente para construir una plataforma funcional y evitar implementar demasiadas funcionalidades al mismo tiempo.

### Fase 1. Plataforma académica base

- Registro e inicio de sesión.
- Perfil del estudiante.
- Gestión de materias.
- Gestión de tareas.
- Calendario académico.
- Dashboard.

### Fase 2. Biblioteca inteligente

- Carga de documentos.
- Almacenamiento.
- Extracción de texto.
- Organización por materia.
- Generación de resúmenes.
- Procesamiento de documentos.

### Fase 3. Agente de inteligencia artificial

- Chat académico.
- Integración con modelo de IA.
- Sistema RAG.
- Búsqueda semántica.
- Referencias a documentos.
- Explicaciones personalizadas.

### Fase 4. Centro de estudio inteligente

- Generación de cuestionarios.
- Flashcards.
- Simulacros.
- Evaluación automática.
- Seguimiento de conocimientos.

### Fase 5. Agente planificador y automatizaciones

- Planes de estudio.
- Seguimiento de objetivos.
- Recordatorios.
- Notificaciones.
- Recomendaciones inteligentes.
- Ejecución controlada de herramientas.

### Fase 6. Integraciones y expansión

- Extensión para Chrome.
- Captura autorizada de información visible en Moodle.
- Posible integración con servicios web oficiales de Moodle si la universidad lo permite.
- Mejoras de rendimiento, escalabilidad y experiencia de usuario.

# 14. Visión del proyecto

La visión de MINGO es convertirse en un asistente académico inteligente que acompañe al estudiante durante toda su formación universitaria.

Se busca que la plataforma no sea solamente un lugar donde se registren actividades o se almacenen documentos, sino un entorno donde la información académica pueda transformarse en conocimiento y oportunidades de aprendizaje.

A largo plazo, MINGO podrá evolucionar hacia una solución adaptable a diferentes universidades, plataformas educativas y modalidades de estudio.

Su principal valor estará en combinar organización académica, gestión documental e inteligencia artificial en una sola experiencia, permitiendo que cada estudiante tenga un asistente capaz de comprender sus necesidades y ayudarlo a alcanzar sus objetivos académicos.

---

**MINGO: Tu universidad, tus materiales y tu aprendizaje, organizados con inteligencia.**