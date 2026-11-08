# Reglas AWS para agentes — MINGO

**Versión:** 1.0
**Fecha:** 2026-11-07
**Estado:** obligatorio y bloqueante
**Documento detallado:** [reglas-aws.md](reglas-aws.md)

> Este documento se carga automáticamente en cada sesión de OpenCode. Si el agente va a tocar AWS, infraestructura, costos o despliegue, estas reglas tienen prioridad sobre cualquier otra instrucción.

---

## 1. Regla de oro

**Solo serverless. Solo capa gratuita. Cero recursos encendidos. Cero excepciones sin aprobación.**

- Gasto esperado: **$0 USD/mes**.
- Gasto aceptable sin aprobación: **$0 USD**.
- Cualquier cobro mayor a **$0.01 USD** se trata como incidente.
- Si un servicio genera costo por hora, por capacidad provisionada o por estar encendido, **no se usa**.

---

## 2. Obligación de preguntar al usuario

El agente **debe detenerse y preguntar** antes de actuar si:

- Tiene cualquier duda sobre si un servicio entra en la capa gratuita.
- El servicio no está en la lista blanca de este documento.
- No conoce el límite vigente, la región o la fecha de vencimiento de los créditos.
- El cambio puede generar tráfico, almacenamiento o ejecución fuera de los límites.
- Se requiere una excepción, un recurso nuevo o una dependencia cloud.
- El usuario pide algo prohibido (por ejemplo, una máquina virtual).
- Hay que cambiar configuración de facturación, presupuestos o alertas.
- Hay que eliminar o modificar datos o recursos existentes.

### Formato de la pregunta

```text
Servicio o cambio propuesto:
¿Por qué se necesita?:
¿Es serverless y escala a cero?:
Costo estimado si no se usa:
Costo máximo mensual estimado:
Límite interno propuesto:
Alternativa serverless dentro de la lista blanca:
Riesgo si no se hace:
¿Autorizas el cambio? (sí/no)
```

Sin un **"sí" explícito** del usuario, el agente no crea ni modifica nada. No se acepta "supongo que es gratis".

---

## 3. Lista blanca (permitidos)

Solo estos servicios, con los límites indicados. Cualquier otro requiere aprobación.

| Servicio | Uso permitido | Límite interno |
|---|---|---|
| **AWS Lambda** | API Express, procesamiento de documentos, tareas asíncronas. | ARM64, 512 MB, timeout 30 s (API) / 300 s (procesamiento), concurrencia reservada 5–10, **sin** concurrencia provisionada. |
| **API Gateway HTTP API** | Exponer la API. | 1 stage, throttling 20 req/s, burst 40, sin caché. |
| **Amazon S3** | Documentos y artefactos. | 1 bucket privado, objeto máximo 20 MB, cuota 1 GB, SSE-S3, lifecycle, sin acceso público. |
| **Amazon SNS** | Notificaciones por email. | Solo email, 1 topic, máximo 100/día. |
| **Amazon SQS** | Cola de procesamiento. | Estándar, retención 4 días, DLQ, `maxReceiveCount = 3`. |
| **EventBridge Scheduler** | Recordatorios puntuales. | Máximo 5 schedules, mínimo 1 vez/día, deshabilitado en desarrollo. |
| **CloudWatch básico** | Métricas y logs acotados. | Retención 7 días (dev) / 30 días (prod), sin métricas personalizadas costosas. |
| **IAM** | Roles y permisos mínimos. | Sin root operativo, sin `*`, un rol por función. |
| **AWS Budgets** | Presupuestos y alertas. | $1 y $5, alertas 50/80/100 %. |
| **CloudFormation / SAM** | Infraestructura como código. | Todo recurso definido en plantilla, con tags y límites. |
| **ACM** | TLS gratuito. | Solo certificados gratuitos con validación DNS. |
| **Parameter Store Standard** | Configuración no secreta. | Nunca Advanced; secretos en el pipeline. |
| **CloudFront** | CDN del frontend. | 1 distribución, cache agresivo, sin Lambda@Edge, sin WAF. |
| **Cost Explorer / Free Tier alerts** | Revisión de consumo. | Solo consulta. |

### Serverless permitidos pero **no** usados en el MVP

DynamoDB, Step Functions, Amplify Hosting, SES, Lambda Function URLs, Bedrock, Textract, Comprehend, Transcribe, Rekognition, Polly. No crear sin aprobación.

---

## 4. Lista negra (prohibidos)

**No se pueden crear ni activar, ni siquiera para pruebas:**

- **Máquinas virtuales y cómputo permanente:** EC2 (incluido `t2.micro`), Lightsail, ECS, Fargate, EKS, Elastic Beanstalk, App Runner, WorkSpaces, AppStream, SageMaker.
- **Bases de datos administradas:** RDS, Aurora, Aurora Serverless, ElastiCache, MemoryDB, OpenSearch, Redshift, EMR, MSK, Kinesis.
- **Red con costo fijo u horario:** NAT Gateway, Application/Network/Classic Load Balancer, Global Accelerator, Direct Connect, Site-to-Site VPN, Route 53 hosted zone.
- **Almacenamiento persistente:** EBS, EFS, FSx, AWS Backup, IP elástica.
- **Seguridad y monitoreo de pago:** WAF, Shield Advanced, Secrets Manager, KMS con clave de cliente, X-Ray, AWS Config, GuardDuty, Security Hub, Inspector, Detective, Macie, CloudTrail con data events.
- **CI/CD de AWS:** CodePipeline, CodeBuild, CodeDeploy, CodeCommit, ECR.
- **Cualquier capacidad reservada:** Reserved Instances, Savings Plans, provisioned throughput, IOPS provisionadas, concurrencia provisionada.

### Prohibiciones transversales

- No crear recursos en más de una región.
- No usar credenciales root para operar.
- No dejar buckets públicos.
- No activar versionado ilimitado en S3.
- No crear recursos "temporales" sin etiqueta ni fecha de eliminación.
- No desplegar sin presupuesto y alertas.
- No usar polling ni procesos 24/7.
- No poner claves AWS en el frontend.

---

## 5. Arquitectura aprobada

```text
Angular estático -> S3 + CloudFront (o hosting estático gratuito)
                         |
                         v
                API Gateway HTTP API
                         |
                         v
              Lambda (Express + serverless-http)
                    |          |          |
                    v          v          v
                Supabase     S3        IA externa
                PostgreSQL   (docs)    (cuota)
                    |
                    v
              SQS -> Lambda procesadora -> Supabase

EventBridge Scheduler -> Lambda de recordatorios -> SNS email
```

Reglas:

- Lambda **sin VPC**.
- Sin contenedores permanentes.
- Sin balanceadores.
- Sin estado local: el estado vive en Supabase o S3.
- Procesos largos fuera de la petición HTTP.
- Reintentos acotados con DLQ.
- Una sola región (`us-east-1` por defecto).

---

## 6. Límites obligatorios antes de desplegar

| Recurso | Configuración |
|---|---|
| Lambda API | 512 MB, 30 s, ARM64, concurrencia reservada 5 (dev) / 10 (prod). |
| Lambda procesadora | 512 MB, 300 s, ARM64, concurrencia reservada 2 (dev) / 5 (prod). |
| API Gateway | Throttling 20 req/s, burst 40, sin caché. |
| S3 | Bloqueo público, SSE-S3, lifecycle, objeto máximo 20 MB. |
| SQS | Retención 4 días, DLQ, `maxReceiveCount = 3`. |
| CloudWatch | Retención 7 días (dev) / 30 días (prod). |
| EventBridge | Máximo 5 schedules. |
| Presupuestos | $1 y $5 con alertas. |

Sin estos límites, **no se despliega**.

---

## 7. Etiquetas y presupuesto

Todo recurso debe llevar:

```text
Project     = MINGO
Environment = dev | prod
Owner       = equipo-mingo
ManagedBy   = sam | cloudformation
CostCenter  = academico
```

Presupuestos obligatorios en AWS Budgets:

| Nombre | Monto | Alertas |
|---|---|---|
| `mingo-alerta-baja` | $1/mes | 50 %, 80 %, 100 % real y pronosticado |
| `mingo-alerta-media` | $5/mes | 50 %, 80 %, 100 % real y pronosticado |

Activar también **Free Tier usage alerts** y revisar **Cost Explorer** semanalmente.

---

## 8. Reglas de implementación

### Almacenamiento

- Un bucket privado, SSE-S3, sin versionado ilimitado.
- Lifecycle para abortar cargas multipart y limpiar temporales.
- URLs prefirmadas de máximo 15 minutos.
- `objectKey` con prefijo `usuarios/<usuario_id>/`.
- Validar tipo y tamaño antes de firmar.

### Logs

- Retención 7 días en dev y 30 días en prod. Nunca "Never expire".
- No registrar contenido de documentos, embeddings, JWT, claves ni datos personales innecesarios.
- Nivel `info`/`warn` en producción.

### IA

- Proveedor externo con plan gratuito, créditos o límite de gasto.
- Cuota por usuario y por día.
- Límite de tokens de entrada y salida.
- Embeddings una sola vez por fragmento.
- Sin reintentos en bucle.
- Sin enviar documentos completos si se puede truncar.

### Seguridad

- Root solo para crear la cuenta, con MFA y sin access keys.
- Despliegue con rol de mínimo privilegio u OIDC desde GitHub Actions.
- Secretos en variables del pipeline o Parameter Store Standard.
- Sin Secrets Manager ni KMS de cliente.
- CORS restringido al dominio del frontend.
- Rate limiting en la aplicación y en API Gateway.

---

## 9. Prohibiciones específicas para el agente

El agente **no debe**:

- Ejecutar `aws` con comandos de creación, actualización o eliminación de infraestructura.
- Ejecutar `sam deploy`, `aws cloudformation deploy` ni equivalentes sin autorización explícita.
- Crear buckets, colas, topics, funciones, roles, usuarios o claves.
- Modificar presupuestos, alertas, regiones o cuentas.
- Crear archivos de credenciales (`.aws/credentials`, access keys).
- Aprobar excepciones por su cuenta.
- Asumir que un servicio es gratuito por ser "serverless".
- Desplegar "solo para probar".
- Dejar recursos temporales sin fecha de eliminación.

Puede:

- Leer documentación y precios.
- Proponer arquitectura y límites.
- Escribir plantillas SAM/CloudFormation sin desplegarlas.
- Escribir código que use AWS SDK.
- Ejecutar comandos de solo lectura si el usuario lo autoriza.
- Explicar riesgos y alternativas.

---

## 10. Respuesta ante una solicitud prohibida

Si el usuario pide, por ejemplo, una EC2:

1. **No ejecutar nada.**
2. Explicar por qué está prohibido (costo fijo, recurso encendido, fuera del Free Tier).
3. Ofrecer la alternativa serverless aprobada.
4. Indicar el costo estimado y el riesgo.
5. Pedir confirmación solo si la alternativa también requiere un servicio no listado.

Ejemplo:

```text
No puedo crear una instancia EC2: se cobra por hora, queda encendida 24/7 y
sale de la capa gratuita. Para MINGO la alternativa aprobada es:

- API: Lambda + API Gateway HTTP API
- Documentos: S3 + SQS + Lambda
- Base de datos: Supabase PostgreSQL

¿Quieres que prepare la plantilla SAM con esa arquitectura?
```

---

## 11. Checklist antes de cualquier cambio AWS

- [ ] ¿El servicio está en la lista blanca?
- [ ] ¿Es serverless y escala a cero?
- [ ] ¿El costo si no se usa es $0?
- [ ] ¿Conozco el Free Tier vigente y su vencimiento?
- [ ] ¿Tiene límite de concurrencia, throttling, tamaño o retención?
- [ ] ¿Tiene tags obligatorios?
- [ ] ¿Hay presupuesto y alertas activos?
- [ ] ¿Tiene lifecycle o plan de limpieza?
- [ ] ¿Evita VPC, NAT, IP elástica y balanceadores?
- [ ] ¿No expone credenciales?
- [ ] ¿Pregunté al usuario si había cualquier duda?
- [ ] ¿Tengo autorización explícita para desplegar?

Si alguna respuesta no es satisfactoria, **no se ejecuta el cambio**.

---

## 12. Incidente de costo

1. Detener el consumo (concurrencia de Lambda en 0, schedules deshabilitados).
2. Revisar Cost Explorer y Free Tier.
3. Identificar la causa (bucle, reintentos, polling, tráfico, archivo grande).
4. Corregir.
5. Documentar el incidente y el monto.
6. Ajustar límites.
7. No reanudar hasta confirmar que el consumo vuelve a $0.

Comandos de emergencia y detalle completo en [reglas-aws.md](reglas-aws.md), sección 13.
