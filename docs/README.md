# Documentación de MINGO

Indice de documentos técnicos y de proceso del proyecto.

## Documentos principales

| Documento | Contenido | Cuándo usarlo |
|---|---|---|
| [reglas-aws.md](reglas-aws.md) | Reglas obligatorias: solo serverless y capa gratuita, lista blanca/negra, límites, presupuestos, alertas y apagado de emergencia. | Antes de crear o desplegar cualquier recurso AWS. |
| [arquitectura.md](arquitectura.md) | Vista general de la arquitectura, componentes, flujos y decisiones. | Para entender el sistema y ubicar un cambio. |
| [base-datos.md](base-datos.md) | Modelo actual de 14 tablas, diccionario de campos, relaciones, DDL, RLS, pgvector y migraciones. | Antes de crear tablas, consultas o políticas. |
| [api.md](api.md) | Contrato REST: endpoints, formatos, códigos de estado y ejemplos. | Al implementar o consumir endpoints. |
| [seguridad.md](seguridad.md) | Autenticación, autorización, secretos, archivos, IA y respuesta a incidentes. | En cada cambio que toque datos o accesos. |
| [ia-rag.md](ia-rag.md) | Pipeline RAG, herramientas del agente, prompts, citas y control de consumo. | Al implementar chat, resúmenes, cuestionarios o embeddings. |
| [convenciones.md](convenciones.md) | Estilo de código, nombres, ramas, commits, PR y Definition of Done. | Todos los días, antes de cada commit. |
| [entornos-y-despliegue.md](entornos-y-despliegue.md) | Variables de entorno, ejecución local, despliegue serverless, CI/CD y rollback. | Al configurar el proyecto o desplegar. |
| [plan-pruebas.md](plan-pruebas.md) | Estrategia de pruebas, matriz por sprint, casos críticos y criterios de aceptación. | Al cerrar una historia de usuario. |

## Documentos de contexto del proyecto

En la raíz del repositorio:

- [problemaInicial.md](../problemaInicial.md): problema, solución, alcance y fases.
- [historiasUsuarios.md](../historiasUsuarios.md): 18 historias de usuario y 3 sprints.
- [tecnologias.md](../tecnologias.md): arquitectura tecnológica, base de datos y servicios.

## Regla de mantenimiento

- Todo cambio de arquitectura, endpoint, tabla o servicio AWS debe actualizar el MD correspondiente en el mismo pull request.
- Los documentos no deben contener credenciales, claves ni datos personales.
- Si una decisión reemplaza a otra, se actualiza el documento y se deja nota de la fecha del cambio.
