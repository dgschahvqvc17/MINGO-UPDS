# Reglas de uso de AWS — MINGO

**Versión:** 1.0  
**Estado:** Obligatorio para todo el equipo  
**Alcance:** Todos los servicios AWS usados por MINGO (desarrollo, pruebas y producción)  
**Objetivo:** Mantener la factura de AWS en **$0 dentro de la capa gratuita**, usando **exclusivamente arquitectura serverless** y evitando cualquier recurso que genere cobros por estar encendido o inactivo.

> **Regla de oro:** si un servicio no está en la lista blanca de este documento, **no se usa**. Si no es serverless, **no se usa**. Si puede generar un cobro por hora o por capacidad provisionada, **no se usa**.

---

## 1. Las cinco reglas obligatorias

1. **Solo serverless.** Nada de servidores, máquinas virtuales, contenedores permanentes ni bases de datos administradas que se mantengan encendidas.
2. **Solo capa gratuita.** Todo consumo debe caber en el Free Tier vigente o en créditos gratuitos. Si un servicio deja de ser gratuito al superar un límite, se debe limitar el consumo desde el código y la configuración.
3. **Cero recursos ociosos.** Ningún recurso puede quedar encendido, provisionado o esperando tráfico 24/7. Todo debe activarse por eventos o solicitudes.
4. **Límites antes de desplegar.** Ningún servicio se despliega sin límites de concurrencia, throttling, tamaño, retención de logs, presupuesto y alertas.
5. **Sin excepciones silenciosas.** Cualquier excepción debe documentarse, justificarse, aprobarse y tener fecha de revisión. Ver sección 12.

---

## 2. Definiciones del proyecto

| Término | Significado en MINGO |
|---|---|
| **Serverless** | Servicio que no requiere administrar servidores, escala a cero y cobra solo por uso (solicitudes, ejecución, almacenamiento o mensajes). |
| **Recurso ocioso** | Cualquier recurso que genera costo aunque nadie lo use: instancia encendida, base de datos activa, balanceador, NAT Gateway, clúster, disco, IP elástica, etc. |
| **Capa gratuita** | Límite gratuito vigente de AWS para la cuenta. Puede ser "siempre gratis", promocional por 12 meses o créditos con vencimiento, según la antigüedad y tipo de cuenta. |
| **Límite interno** | Restricción más estricta que impone MINGO (por ejemplo, 512 MB de memoria en Lambda aunque AWS permita más). |
| **Presupuesto de emergencia** | Monto máximo que el equipo acepta gastar si algo falla. Para MINGO: **$0**. Cualquier cobro es un incidente. |

> **Advertencia sobre el Free Tier (2026):** AWS cambió las condiciones para cuentas nuevas en los últimos años. Algunas cuentas reciben créditos promocionales con vencimiento en lugar del modelo anterior de 12 meses. Los servicios "siempre gratis" también tienen límites. **Nunca asumir que un servicio es gratuito de forma permanente.** Antes de desplegar, revisar `Billing and Cost Management → Free Tier` y la página de precios oficial del servicio.

---

## 3. Lista blanca: servicios permitidos

Solo se pueden usar los siguientes servicios, con los límites indicados.

| Servicio | Uso permitido en MINGO | Límites internos obligatorios |
|---|---|---|
| **AWS Lambda** | API Express empaquetada para Lambda, procesamiento de documentos, generación de embeddings, tareas asíncronas. | ARM64, 512 MB, timeout 30 s (API) / 300 s (documentos), concurrencia reservada 5–10, **sin** concurrencia provisionada, **sin** Lambda@Edge. |
| **Amazon API Gateway (HTTP API)** | Exponer la API y funciones Lambda. Preferir HTTP API sobre REST API por costo. | 1 stage, throttling 20 req/s y burst 40, **sin** caché, **sin** logs de ejecución completos. |
| **Amazon S3** | Documentos académicos y artefactos de despliegue. | 1 bucket privado, objeto máximo 20 MB, cuota interna 1 GB para MVP, SSE-S3, versionado desactivado o con expiración de 7 días, lifecycle activo. |
| **Amazon SNS** | Notificaciones por correo electrónico. | Solo email (nunca SMS), 1 topic, máximo 100 notificaciones/día, suscripciones filtradas. |
| **Amazon SQS** | Cola de procesamiento asíncrono de documentos y reintentos. | Cola estándar (no FIFO), retención 4 días, DLQ con `maxReceiveCount = 3`. |
| **Amazon EventBridge Scheduler** | Recordatorios y procesos programados puntuales. | Máximo 5 schedules, frecuencia mínima 1 vez/día, deshabilitados en desarrollo. |
| **Amazon CloudWatch (básico)** | Métricas estándar de Lambda/API y logs acotados. | Retención de logs 7 días (dev) / 30 días (prod), sin logs de contenido de documentos, sin métricas personalizadas de alta cardinalidad. |
| **AWS IAM** | Usuarios, roles y políticas de mínimo privilegio. | Sin claves de root, sin `*` en acciones/recursos, un rol por función. |
| **AWS Budgets** | Presupuestos y alertas de facturación. | 2 presupuestos gratuitos: $1 y $5, alertas al 50 %, 80 % y 100 %. |
| **AWS CloudFormation / AWS SAM** | Infraestructura como código y despliegue reproducible. | Todo recurso se define en plantilla, con tags y límites. |
| **AWS Certificate Manager (ACM)** | Certificados TLS gratuitos para CloudFront/API. | Solo certificados gratuitos con validación DNS. |
| **AWS Systems Manager Parameter Store (Standard)** | Parámetros de configuración no secretos. | Solo parámetros Standard, nunca Advanced. Secretos reales van en variables de entorno del pipeline, no en el repositorio. |
| **Amazon CloudFront** | CDN para frontend estático y assets. | 1 distribución, cache agresivo, Price Class más económica que mantenga latencia aceptable, **sin** Lambda@Edge, **sin** WAF. |
| **AWS Cost Explorer / Free Tier alerts** | Revisión de consumo. | Solo consulta, sin informes costosos. |

### Servicios que también son serverless pero **no se usan en el MVP**

| Servicio | Motivo |
|---|---|
| DynamoDB | La base de datos es Supabase PostgreSQL. Duplicar almacenamiento genera costos y complejidad. |
| Step Functions | No se necesita orquestación compleja; Lambda + SQS cubren el MVP. |
| AWS Amplify Hosting | Tiene capa gratuita limitada y puede generar costos de build/almacenamiento. Preferir S3 + CloudFront o un hosting estático gratuito externo. |
| Amazon SES | El MVP usa SNS para avisos simples y Supabase Auth para correos de autenticación. |
| AWS Lambda Function URLs | Solo con autorización y throttling; por defecto se usa API Gateway. |
| Amazon Bedrock | El proveedor de IA es externo y se controla con cuotas propias. Bedrock se cobra por token. |
| Textract / Comprehend / Transcribe / Rekognition / Polly | Se cobran por uso y no son necesarios: la extracción se hace con librerías dentro de Lambda. |

---

## 4. Lista negra: servicios prohibidos

Estos servicios **no se pueden crear ni activar**, incluso para pruebas, salvo excepción formal aprobada (sección 12).

| Servicio prohibido | Motivo | Riesgo de factura |
|---|---|---|
| **Amazon EC2** (cualquier tipo, incluido `t2.micro`) | Servidor encendido 24/7. El Free Tier es temporal. | Alto |
| **Lightsail** | Instancia con costo mensual fijo. | Alto |
| **ECS / Fargate** | Contenedores con tareas que consumen CPU/memoria mientras corren. | Alto |
| **EKS** | Clúster con costo por hora del plano de control. | Muy alto |
| **Elastic Beanstalk / App Runner** | Aprovisiona cómputo permanente o con costo por instancia. | Alto |
| **RDS / Aurora / Aurora Serverless** | Base de datos administrada encendida o con almacenamiento/ACU mínimos. La base es Supabase. | Alto |
| **ElastiCache / MemoryDB** | Nodos de caché encendidos. Usar memoria del proceso o PostgreSQL. | Alto |
| **OpenSearch / Elasticsearch Service** | Clúster con costo por hora y almacenamiento. La búsqueda semántica usa pgvector. | Alto |
| **Redshift / EMR / MSK / Kinesis** | Clústeres o capacidad provisionada. | Muy alto |
| **NAT Gateway** | Se cobra por hora y por GB procesado, incluso sin tráfico. | Muy alto |
| **Application/Network/Classic Load Balancer** | Se cobra por hora y por capacidad. | Alto |
| **EBS / EFS / FSx / AWS Backup** | Almacenamiento persistente que se cobra aunque no se use. | Medio |
| **IP elástica / Elastic IP** | Se cobra si no está asociada a un recurso elegible. | Medio |
| **Route 53 (hosted zone)** | Zona hospedada con costo mensual. Usar DNS gratuito del proveedor del dominio. | Bajo pero evitable |
| **AWS WAF / Shield Advanced** | WAF tiene costo mensual por WebACL y reglas; Shield Advanced es caro. | Alto |
| **Global Accelerator / Direct Connect / Site-to-Site VPN** | Infraestructura de red permanente. | Muy alto |
| **Secrets Manager** | Cobro mensual por secreto. Usar variables de entorno o Parameter Store Standard. | Bajo pero evitable |
| **KMS (claves administradas por el cliente)** | Cobro mensual por clave. Usar cifrado SSE-S3. | Bajo pero evitable |
| **SageMaker (notebooks, endpoints, training)** | Cómputo persistente o por hora. | Muy alto |
| **WorkSpaces / AppStream** | Escritorios virtuales con costo fijo. | Alto |
| **CodePipeline / CodeBuild / CodeDeploy / CodeCommit** | Se evita la cadena CI/CD de AWS; se usa GitHub Actions gratuito. | Medio |
| **ECR** | Almacenamiento de imágenes; el despliegue usa paquetes ZIP de Lambda. | Bajo |
| **X-Ray / AWS Config / GuardDuty / Security Hub / Inspector / Detective / Macie** | Funciones de pago o con prueba gratuita que luego cobra. | Medio |
| **CloudTrail con data events / trails a S3** | El historial de eventos de administración por 90 días es suficiente para el MVP. | Bajo |
| **Cualquier recurso con capacidad reservada** | Reserved Instances, Savings Plans, provisioned throughput, IOPS provisionadas. | Alto |

### Prohibiciones transversales

- **No** crear recursos en más de una región.
- **No** usar concurrencia provisionada en Lambda.
- **No** activar versionado ilimitado en S3.
- **No** dejar buckets públicos.
- **No** usar credenciales root para nada operativo.
- **No** crear recursos "temporales" sin etiqueta ni fecha de eliminación.
- **No** desplegar sin presupuesto y alertas configuradas.

---

## 5. Reglas de arquitectura serverless

### 5.1. Flujo permitido

```text
Angular (estático)
      |
      v
CloudFront + S3  (o hosting estático gratuito externo)
      |
      v
API Gateway HTTP API
      |
      v
AWS Lambda (Express empaquetado con serverless-http)
      |
      +--> Supabase PostgreSQL + pgvector
      +--> S3 (documentos, URLs prefirmadas)
      +--> Proveedor de IA externo (API con cuota)
      +--> SNS (notificaciones por email)

S3 (nuevo documento)
      |
      v
SQS (cola + DLQ)
      |
      v
Lambda procesadora (extrae texto, fragmenta, embeddings)

EventBridge Scheduler (opcional)
      |
      v
Lambda de recordatorios
```

### 5.2. Reglas de implementación

1. **Lambda sin VPC.** No se configura VPC para las funciones del MVP. Evita NAT Gateway y Elastic IP.
2. **Express en Lambda.** El backend Express se despliega como función Lambda usando un adaptador (`serverless-http` o AWS Lambda Web Adapter) y API Gateway HTTP API. No se usa EC2 ni contenedores permanentes.
3. **Ejecución por evento.** La API responde a solicitudes; el procesamiento de documentos se dispara con eventos de S3/SQS; los recordatorios solo con EventBridge Scheduler.
4. **Procesos largos fuera de la petición HTTP.** La carga del documento responde rápido y el procesamiento ocurre de forma asíncrona. Así se evita timeouts y reintentos costosos.
5. **Idempotencia.** Cada documento y mensaje debe tener un identificador único para no procesar dos veces lo mismo.
6. **Reintentos acotados.** SQS con DLQ y `maxReceiveCount = 3`. Nunca reintentos infinitos.
7. **Sin polling.** No usar bucles `setInterval` ni consultas cada segundo. Usar eventos, webhooks o consultas del usuario.
8. **Sin estado local.** Lambda puede reiniciarse en cualquier momento; el estado vive en Supabase o S3.
9. **Empaquetado mínimo.** Solo dependencias de producción. Evitar incluir `node_modules` de desarrollo en el ZIP.
10. **Una sola región.** Preferir `us-east-1` por disponibilidad de Free Tier, salvo que se documente otra.

### 5.3. Patrón de carga de documentos (aprobado)

```text
1. Angular solicita URL prefirmada al backend.
2. Backend valida tipo/tamaño y devuelve URL de S3.
3. Angular sube el archivo directamente a S3 (bucket privado).
4. S3 emite evento a SQS.
5. Lambda procesadora extrae texto y genera fragmentos/embeddings.
6. Lambda guarda resultados en Supabase.
7. Se actualiza el estado del documento y se notifica al usuario.
```

Este patrón evita que el archivo pase por Lambda en la carga inicial y reduce tiempo de ejecución.

---

## 6. Límites obligatorios por servicio

Estos valores se configuran en la infraestructura como código, no "a mano" en la consola.

| Recurso | Configuración obligatoria |
|---|---|
| Lambda API | Memoria 512 MB, timeout 30 s, arquitectura ARM64, concurrencia reservada 5 (dev) / 10 (prod) |
| Lambda procesadora | Memoria 512 MB, timeout 300 s, ARM64, concurrencia reservada 2 (dev) / 5 (prod) |
| API Gateway | Throttling 20 req/s, burst 40, sin caché, sin logs de ejecución |
| S3 | Bloqueo de acceso público, SSE-S3, lifecycle, límite de objeto 20 MB |
| SQS | Retención 4 días, DLQ, `maxReceiveCount = 3` |
| CloudWatch Logs | Retención 7 días en dev, 30 días máximo en prod |
| EventBridge Scheduler | Máximo 5 schedules, solo si es imprescindible |
| Presupuestos | $1 y $5 con alertas al 50 %, 80 % y 100 % |

### Reglas de Lambda

- **Memoria:** 512 MB por defecto. Subir solo con medición previa y justificación escrita.
- **Timeout:** el más corto posible. Una API no debe tardar más de 30 s; el procesamiento documental, más de 5 min.
- **Concurrencia reservada:** limita el daño ante un bucle o ataque. Nunca dejarla ilimitada.
- **Concurrencia provisionada:** prohibida.
- **Logs:** nunca imprimir contenido de documentos, embeddings, tokens, correos completos ni claves.
- **Dependencias:** usar `npm ci --omit=dev` para el paquete de despliegue.

### Reglas de API Gateway

- Preferir **HTTP API** (más barato que REST API).
- Un solo stage (`$default` o `prod`).
- Throttling bajo configurado en el stage.
- Sin caché (la caché de API Gateway tiene costo).
- Sin logs de ejecución detallados; solo métricas básicas.
- La autenticación se valida en el backend con Supabase JWT; no se usan API Keys como mecanismo de seguridad.

---

## 7. Presupuesto, etiquetas y alertas

### 7.1. Presupuestos obligatorios

Crear en **AWS Billing and Cost Management → Budgets**:

| Presupuesto | Monto | Alertas |
|---|---|---|
| `mingo-alerta-baja` | $1 USD/mes | 50 %, 80 %, 100 % real y 100 % pronosticado |
| `mingo-alerta-media` | $5 USD/mes | 50 %, 80 %, 100 % real y 100 % pronosticado |

Los dos primeros presupuestos son gratuitos. Enviar alertas al correo del responsable del proyecto y al equipo.

Además:

- Activar **Free Tier usage alerts** en Billing.
- Activar **Cost Anomaly Detection** si no genera costo en la cuenta; si lo genera, usar revisión manual semanal.
- Revisar **Cost Explorer** una vez por semana.
- Revisar la página **Free Tier** al inicio de cada sprint.

### 7.2. Etiquetas obligatorias

Todo recurso desplegado debe llevar:

```text
Project     = MINGO
Environment = dev | prod
Owner       = equipo-mingo
ManagedBy   = sam | cloudformation
CostCenter  = academico
```

Activar las etiquetas como **cost allocation tags** en Billing.

### 7.3. Regla de tolerancia

- **Gasto esperado:** $0 USD.
- **Gasto aceptable sin aprobación:** $0 USD.
- **Cualquier cobro mayor a $0.01 USD:** se trata como incidente (sección 13).

---

## 8. Reglas de almacenamiento y datos

- Un solo bucket S3 para documentos, privado, con **Block Public Access** activado.
- Cifrado **SSE-S3** (no SSE-KMS, porque KMS tiene costo mensual).
- Sin versionado ilimitado. Si se activa, lifecycle para eliminar versiones anteriores en 7 días.
- Lifecycle obligatorio:
  - abortar cargas multipart incompletas después de 1 día;
  - eliminar archivos temporales/procesados después de 7 días;
  - mantener solo documentos del usuario mientras sean necesarios.
- Tamaño máximo por archivo: **20 MB**.
- Formatos permitidos: PDF, DOCX, PPTX, TXT.
- Cuota interna del MVP: **1 GB** de documentos. Al acercarse, avisar y limpiar.
- Usar **URLs prefirmadas de corta duración** (máximo 15 minutos).
- No duplicar documentos: si Supabase Storage ya tiene el archivo, no guardarlo también en S3.

### Supabase (costo externo a AWS, misma filosofía)

- Plan Free, un proyecto por entorno.
- Paginación obligatoria en todas las consultas.
- Índices en columnas de filtro y claves foráneas.
- Sin polling; usar suscripciones o carga bajo demanda.
- No enviar archivos grandes en base64 por la API.
- Revisar límites de base de datos, storage, egress y usuarios activos.
- Los proyectos Free pueden pausarse por inactividad: prever el aviso y el procedimiento de reactivación.

---

## 9. Logs y observabilidad de bajo costo

- Retención de logs: **7 días en desarrollo**, **30 días máximo en producción**.
- Prohibido dejar grupos de logs con retención "Never expire".
- Nivel de log en producción: `info` o `warn`; `debug` solo en desarrollo.
- No registrar:
  - contenido de documentos;
  - embeddings;
  - tokens JWT;
  - claves de API;
  - datos personales innecesarios.
- Usar métricas estándar de Lambda/API Gateway. No crear métricas personalizadas de alta cardinalidad.
- Alertas mínimas:
  - errores 5xx de la API;
  - throttles de Lambda;
  - mensajes en la DLQ;
  - presupuesto superado.

---

## 10. Seguridad y costo

- **Root:** solo para crear la cuenta; MFA obligatorio; sin access keys.
- **Despliegue:** usuario IAM o IAM Identity Center con permisos mínimos y MFA, o rol de GitHub Actions con OIDC.
- **Roles:** un rol por función Lambda, con permisos limitados al bucket, cola y topic necesarios.
- **Secretos:** variables de entorno del pipeline o Parameter Store Standard. Nunca en el repositorio.
- **Sin Secrets Manager ni KMS de cliente** en el MVP por costo.
- **Sin claves de AWS en Angular.** El frontend nunca habla directamente con AWS salvo URLs prefirmadas de S3.
- **CORS restringido** al dominio del frontend.
- **Rate limiting** en la aplicación y en API Gateway.

---

## 11. Reglas de IA y control de consumo

El proveedor de IA es externo a AWS, pero su factura también debe controlarse.

- Usar plan gratuito, créditos iniciales o una clave con límite de gasto.
- Definir cuota por usuario: máximo de mensajes/día y tokens/mes.
- Limitar tokens de entrada y salida por solicitud.
- Cachear resúmenes y explicaciones repetidas.
- Generar embeddings **una sola vez** por fragmento; no regenerar si el documento no cambió.
- Procesar documentos solo bajo demanda, no en lote masivo.
- Truncar o resumir documentos largos antes de enviarlos al modelo.
- Si el proveedor falla o se agota la cuota, la aplicación debe degradar con un mensaje claro, no reintentar en bucle.
- Registrar consumo por usuario para auditoría y control.

---

## 12. Proceso para agregar un servicio nuevo

Ningún servicio de la lista negra o no listado se agrega sin pasar por este proceso.

### 12.1. Checklist obligatorio

Antes de proponer un servicio, responder:

1. ¿Es serverless y escala a cero?
2. ¿Cuánto cuesta si no se usa? (debe ser $0)
3. ¿Cuál es el Free Tier vigente y su fecha de vencimiento?
4. ¿Cuál es el costo por 1.000 solicitudes / GB / hora?
5. ¿Cuál es el costo máximo mensual si se abusa?
6. ¿Qué límite interno se le va a poner?
7. ¿Se puede resolver con un servicio ya permitido?
8. ¿Requiere VPC, NAT, IP elástica o balanceador? (si sí, se rechaza)
9. ¿Tiene lifecycle, retención y limpieza definidos?
10. ¿Está en la lista blanca? Si no, ¿por qué no puede evitarse?

### 12.2. Plantilla de excepción

Toda excepción se documenta en un issue o en `docs/excepciones-aws.md` con:

```text
Servicio:
Justificación:
Alternativas evaluadas:
Costo estimado mensual:
Límite máximo configurado:
Responsable:
Fecha de inicio:
Fecha de revisión/eliminación:
Plan de limpieza:
Aprobado por:
```

Sin aprobación escrita, el servicio no se crea.

---

## 13. Respuesta ante alertas de costo

1. **Detener el consumo** (ver comandos de emergencia).
2. Revisar **Cost Explorer** y **Billing → Free Tier** para identificar el servicio.
3. Revisar logs, concurrencia y tráfico anómalo.
4. Corregir la causa (bucle, reintentos, polling, archivo grande, consulta costosa).
5. Documentar el incidente y el monto.
6. Ajustar límites y presupuestos.
7. No reanudar el servicio hasta confirmar que el consumo vuelve a $0.

### 13.1. Comandos de emergencia

Verificar los nombres reales de los recursos antes de ejecutar. Estos comandos detienen la ejecución, no borran datos:

```bash
# Detener todas las invocaciones de una Lambda (concurrencia reservada = 0)
aws lambda put-function-concurrency \
  --function-name mingo-api \
  --reserved-concurrent-executions 0

aws lambda put-function-concurrency \
  --function-name mingo-document-processor \
  --reserved-concurrent-executions 0

# Deshabilitar un schedule de recordatorios
aws scheduler update-schedule \
  --name mingo-recordatorios \
  --group-name default \
  --state DISABLED \
  --schedule-expression "rate(1 day)" \
  --flexible-time-window Mode=OFF \
  --target '{"Arn":"arn:aws:lambda:us-east-1:000000000000:function:mingo-recordatorios","RoleArn":"arn:aws:iam::000000000000:role/mingo-scheduler-role"}'

# Deshabilitar una regla de EventBridge (si se usara ese mecanismo)
aws events disable-rule --name mingo-recordatorios
```

> Si se necesita detener todo de inmediato, la opción más segura es poner en 0 la concurrencia de todas las Lambdas y deshabilitar los schedules. No eliminar el bucket S3 ni la base de datos sin respaldo.

---

## 14. Revisión mensual obligatoria

Cada inicio de mes, el responsable de infraestructura revisa:

- [ ] Factura actual en Billing (debe ser $0).
- [ ] Consumo de Free Tier por servicio.
- [ ] Presupuestos y alertas activos.
- [ ] Recursos sin etiquetas.
- [ ] Recursos sin uso o duplicados.
- [ ] Retención de logs correcta.
- [ ] Tamaño del bucket S3 y lifecycle.
- [ ] Mensajes en DLQ y errores de Lambda.
- [ ] Consumo de IA y Supabase.
- [ ] Fecha de vencimiento de créditos o promociones.

El resultado se registra en el issue mensual de costos.

---

## 15. Escenarios frecuentes: decisión aprobada

| Necesidad | Solución aprobada | Alternativa prohibida |
|---|---|---|
| Hosting del frontend | S3 + CloudFront (o hosting estático gratuito externo) | EC2, Amplify con costo, contenedor |
| API del backend | Lambda + API Gateway HTTP API | EC2, ECS, Elastic Beanstalk, App Runner |
| Base de datos | Supabase PostgreSQL | RDS, Aurora, DynamoDB |
| Archivos | S3 privado con URLs prefirmadas | EBS, EFS, disco local |
| Procesamiento de documentos | S3 → SQS → Lambda | Servidor worker encendido |
| Recordatorios | EventBridge Scheduler | Cron en EC2, proceso 24/7 |
| Notificaciones | SNS email | SMS, SES masivo |
| Búsqueda semántica | Supabase pgvector | OpenSearch, ElastiCache |
| Caché | Memoria del proceso o PostgreSQL | ElastiCache, MemoryDB |
| Monitoreo | CloudWatch básico + Budgets | X-Ray, Datadog de pago, Config |
| CI/CD | GitHub Actions + SAM | CodePipeline, CodeBuild |
| Secretos | Variables del pipeline / SSM Standard | Secrets Manager, KMS de cliente |
| Correos de autenticación | Supabase Auth | SES, servidor SMTP propio |
| Tareas asíncronas | SQS + Lambda | Cola en servidor permanente |

---

## 16. Definición de cumplimiento

Un cambio se considera conforme solo si:

- [ ] Usa únicamente servicios de la lista blanca.
- [ ] No crea recursos ociosos ni de costo por hora.
- [ ] Tiene límites de concurrencia, throttling y retención configurados.
- [ ] Tiene etiquetas obligatorias.
- [ ] Tiene presupuesto y alertas verificadas.
- [ ] Tiene plan de limpieza y lifecycle cuando aplica.
- [ ] No expone credenciales.
- [ ] Fue revisado por otra persona del equipo.
- [ ] El costo esperado es $0 y el costo máximo está acotado.

Si alguna casilla no se cumple, **el despliegue se rechaza**.

---

## 17. Enlaces oficiales de consulta

Verificar siempre las condiciones vigentes antes de desplegar:

- AWS Free Tier: <https://aws.amazon.com/free/>
- Precios de AWS Lambda: <https://aws.amazon.com/lambda/pricing/>
- Precios de API Gateway: <https://aws.amazon.com/api-gateway/pricing/>
- Precios de Amazon S3: <https://aws.amazon.com/s3/pricing/>
- Precios de Amazon SNS: <https://aws.amazon.com/sns/pricing/>
- Precios de Amazon SQS: <https://aws.amazon.com/sqs/pricing/>
- Precios de EventBridge: <https://aws.amazon.com/eventbridge/pricing/>
- Precios de CloudWatch: <https://aws.amazon.com/cloudwatch/pricing/>
- Precios de CloudFront: <https://aws.amazon.com/cloudfront/pricing/>
- AWS Budgets: <https://aws.amazon.com/aws-cost-management/aws-budgets/>
- Documentación de AWS SAM: <https://docs.aws.amazon.com/serverless-application-model/>

---

**Resumen final:** MINGO solo usa servicios serverless dentro de la capa gratuita, con límites explícitos y alertas de presupuesto. Si un servicio puede generar una factura por estar encendido, no se usa. Si no está en la lista blanca, no se usa. Cualquier excepción requiere justificación, aprobación, límite y fecha de revisión.
