# Excepciones AWS aprobadas — MINGO

**Estado:** obligatorio
**Fecha:** 2026-11-18

Este documento registra las excepciones a `docs/reglas-aws.md` y
`docs/reglas-aws-agente.md`. Toda excepción debe tener justificación, aprobación
explícita del dueño del proyecto y fecha de revisión. No se permite ninguna
excepción silenciosa.

---

## EXC-001 — Sin concurrencia reservada en la Lambda procesadora (dev)

```text
Servicio: AWS Lambda (mingo-hu09-dev-procesador)

Justificación:
  La cuenta AWS 591015654164 está compartida con otro proyecto. El límite de
  1000 ejecuciones concurrentes está casi agotado por reservas ajenas: solo
  quedan 10 sin reservar y AWS exige mantener un mínimo de 10. Al crear la
  Lambda con ReservedConcurrentExecutions=2, CloudFormation respondió:
  "Specified ReservedConcurrentExecutions for function decreases account's
  UnreservedConcurrentExecution below its minimum value of [10]".
  Cualquier valor mayor que 0 produce el mismo rechazo.

Alternativas evaluadas:
  1. Aumentar el límite de concurrencia de la cuenta a 1100+: requiere un
     cambio en la cuenta compartida y acceso de administrador; MINGO no puede
     hacerlo y afectaría a otro proyecto. Descartada por ahora.
  2. Reducir las reservas de otras Lambdas de la cuenta: son recursos de otro
     proyecto. Descartada: no se pueden modificar sin autorización.
  3. No reservar concurrencia en dev (0) y mantener la reserva de 5 en prod:
     elegida. No genera costo y mantiene el límite en producción.

Costo estimado mensual:
  $0 USD. La concurrencia reservada no tiene cargo; la ejecución real se rige
  por la capa gratuita y el volumen es muy bajo (eventos S3 -> SQS).

Límite máximo configurado:
  Memoria 512 MB, timeout 300 s, ARM64, concurrencia sin reservar en dev.
  En prod se mantiene la reserva de 5 (regla original). Sin concurrencia
  provisionada en ningún entorno. Dado que el único productor de mensajes es
  el bucket S3 filtrado por "usuarios/", el número de invocaciones simultáneas
  está acotado por el volumen de documentos subidos por los estudiantes.

Responsable: equipo-mingo

Fecha de inicio: 2026-11-18

Fecha de revisión/eliminación: 2027-02-18

Plan de limpieza:
  Antes del 2027-02-18 se debe revisar el consumo de concurrencia de la cuenta
  compartida. Si hay al menos 12 ejecuciones sin reservar, volver a aplicar
  ReservedConcurrentExecutions=2 en dev mediante el parámetro
  ProcessorConcurrency y eliminar esta excepción. Si el otro proyecto sigue
  consumiendo la cuota, escalar el límite de la cuenta con aprobación de ambos
  equipos. Mientras tanto, vigilar CloudWatch y Cost Explorer semanalmente.

Aprobado por:
  Dueño del proyecto MINGO, 2026-11-18 (aprobación explícita en la sesión de
  despliegue de HU09; se eligió la opción "Excepción temporal: sin reserva").
```
