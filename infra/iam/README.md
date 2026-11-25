# Permisos IAM complementarios para `mingo-agente`

**Estado:** políticas 1, 2, 3, 4 y 5 aplicadas.
**Cuenta:** `591015654164`.
**Región:** `us-east-1`.
**Costo:** `$0`. No crean recursos con costo.

Estas políticas corrigen cinco limitaciones detectadas durante el despliegue y las pruebas E2E de `dev`:

1. `mingo-agente` no puede subir artefactos de Lambda con `aws cloudformation package`.
2. `mingo-agente` no puede consultar Cost Explorer.
3. `mingo-agente` no puede recuperar un stack con `cloudformation:ContinueUpdateRollback`.
4. `mingo-agente` no puede pasar roles a Lambda ni leer artefactos desde S3, necesario para sincronizar CloudFormation con el código desplegado.
5. `mingo-agente` no puede borrar los objetos S3 temporales creados por las pruebas E2E.

El agente de OpenCode **no crea ni modifica IAM**. Un administrador debe aplicar las políticas con credenciales locales propias. No se usan credenciales root para operar.

## 1. Artefactos de CloudFormation

Archivo: [`mingo-agente-artefactos-dev.json`](mingo-agente-artefactos-dev.json).

Permite subir zips temporales solo a:

```text
s3://mingo-documentos-dev-591015654164/tmp/artifacts/*
```

El bucket ya existe, es privado y tiene lifecycle que expira `tmp/` en 1 día. No se agrega `s3:DeleteObject`, `s3:PutObjectAcl` ni acceso a otros prefijos. El JSON está en una sola línea (577 caracteres) para pegarlo directamente en el editor de IAM Console; los `Sid` se omitieron porque son solo etiquetas opcionales.

No usar el bucket frontend para artefactos: su política permite `s3:GetObject` a CloudFront con `SourceArn` de la distribución `E3KT1CRPPEGF3B`, por lo que los zips quedarían servidos por CloudFront.

Si el editor de IAM Console rechaza incluso la versión compacta, usar [`mingo-agente-artefactos-dev-minima.json`](mingo-agente-artefactos-dev-minima.json): tiene 376 caracteres, mantiene la escritura limitada a `tmp/artifacts/*` y no permite `s3:GetObject`.

### Aplicación por un administrador

```bash
aws iam get-user-policy \
  --user-name mingo-agente \
  --policy-name MingoPackageArtifactsDev \
  --profile <perfil-admin> \
  --region us-east-1

aws iam put-user-policy \
  --user-name mingo-agente \
  --policy-name MingoPackageArtifactsDev \
  --policy-document file://infra/iam/mingo-agente-artefactos-dev.json \
  --profile <perfil-admin> \
  --region us-east-1
```

Si el usuario pertenece a un grupo y la política se administra allí, el administrador debe adaptar el comando. `put-user-policy` reemplaza la política inline con el mismo nombre.

## 2. Cost Explorer

Archivo: [`mingo-agente-cost-explorer-readonly.json`](mingo-agente-cost-explorer-readonly.json).

Cost Explorer no admite restricciones por recurso, por eso `Resource` es `*`. La política es solo lectura y no modifica facturación, presupuestos ni alertas.

**Excepción documentada 2026-11-25.** La regla interna de IAM indica “sin `*`”. AWS no permite limitar `ce:GetCostAndUsage` ni `ce:GetCostForecast` por ARN, así que el comodín es inevitable. Se compensa con dos acciones concretas de solo lectura, sin `ce:*`, sin escrituras y sin acceso a presupuestos o facturación. Aprobado por el dueño del proyecto el 2026-11-25. Fecha de revisión: 2027-02-25.

### Aplicación por un administrador

```bash
aws iam get-user-policy \
  --user-name mingo-agente \
  --policy-name MingoCostExplorerReadonly \
  --profile <perfil-admin> \
  --region us-east-1

aws iam put-user-policy \
  --user-name mingo-agente \
  --policy-name MingoCostExplorerReadonly \
  --policy-document file://infra/iam/mingo-agente-cost-explorer-readonly.json \
  --profile <perfil-admin> \
  --region us-east-1
```

La cuenta está compartida con Concesionaria BMW. El total de la cuenta no equivale al gasto de MINGO. Para aislarlo por etiqueta haría falta activar la cost allocation tag `Project`, cambio de facturación que requiere autorización separada.

## 3. Recuperación del stack `dev`

Archivo: [`mingo-recovery-dev.json`](mingo-recovery-dev.json).

El 2026-11-25 se ejecutó el changeset `roles-docente-pruned-20261125` y falló por dos permisos ausentes:

- `iam:PassRole` sobre el rol de la Lambda API.
- `s3:GetObject` sobre el artefacto anterior de Lambda durante el rollback.

El código real de las tres Lambda quedó correcto y activo (`LastUpdateStatus=Successful`), pero el stack terminó en `UPDATE_ROLLBACK_FAILED`. La recuperación acordada es continuar el rollback omitiendo `ApiFunction`, `ProcesadorFunction` y `RecordatoriosFunction`, para no revertir el código ya desplegado.

Esta política permite solo esa acción, limitada al stack `mingo-hu09-dev`. No crea ni modifica recursos y cuesta `$0`.

### Aplicación por un administrador

```bash
aws iam create-policy \
  --policy-name MingoRecoveryDev \
  --policy-document file://infra/iam/mingo-recovery-dev.json \
  --region us-east-1

aws iam attach-user-policy \
  --user-name mingo-agente \
  --policy-arn arn:aws:iam::591015654164:policy/MingoRecoveryDev \
  --region us-east-1
```

También puede crearse desde **IAM → Policies → Create policy → JSON** y adjuntarse a `mingo-agente` desde **Users → mingo-agente → Add permissions → Attach policies directly**.

Tras aplicarla, el agente ejecuta:

```bash
aws cloudformation continue-update-rollback \
  --stack-name mingo-hu09-dev \
  --resources-to-skip ApiFunction ProcesadorFunction RecordatoriosFunction \
  --profile mingo-agente \
  --region us-east-1
```

Después de la recuperación, CloudFormation conservó la plantilla anterior mientras el código de las Lambda era el nuevo. Esa deriva se eliminó con el changeset de la sección 4.

## 4. Sincronización de CloudFormation con el código desplegado

Archivo: [`mingo-lambda-deploy-dev.json`](mingo-lambda-deploy-dev.json).

El 25/11/2026 las Lambda quedaron con el código correcto, pero el stack terminó en `UPDATE_ROLLBACK_COMPLETE` con la plantilla anterior. Para que CloudFormation volviera a coincidir con el código real faltaban dos permisos durante el changeset:

- `iam:PassRole` sobre los tres roles de Lambda:
  - `arn:aws:iam::591015654164:role/mingo-api-dev-lambda-role`
  - `arn:aws:iam::591015654164:role/mingo-hu18-recordatorios-lambda`
  - `arn:aws:iam::591015654164:role/mingo-hu09-dev-ProcesadorRole-kkfCOukGI8xX`
- `s3:GetObject` sobre los artefactos nuevos (`tmp/artifacts/*`) y los anteriores (`artifacts/*`) del bucket `mingo-documentos-dev-591015654164`.

No se permite `s3:GetObject` sobre `usuarios/*`, por lo que no se expone contenido de documentos. Costo `$0`; no crea recursos.

### Aplicación por un administrador

```bash
aws iam create-policy \
  --policy-name MingoLambdaDeployDev \
  --policy-document file://infra/iam/mingo-lambda-deploy-dev.json \
  --region us-east-1

aws iam attach-user-policy \
  --user-name mingo-agente \
  --policy-arn arn:aws:iam::591015654164:policy/MingoLambdaDeployDev \
  --region us-east-1
```

También puede crearse desde **IAM → Policies → Create policy → JSON** y adjuntarse a `mingo-agente` desde **Users → mingo-agente → Add permissions → Attach policies directly**.

La política fue aplicada por el administrador. El agente creó y ejecutó el changeset `roles-docente-sync-20261125` sobre la plantilla empaquetada con los zips ya validados; el stack terminó en `UPDATE_COMPLETE`. El código de las Lambda no cambió: solo se actualizó el registro de CloudFormation.

## 5. Limpieza de objetos S3 temporales

Archivo: [`mingo-s3-cleanup-dev.json`](mingo-s3-cleanup-dev.json).

Permite únicamente `s3:DeleteObject` sobre:

```text
arn:aws:s3:::mingo-documentos-dev-591015654164/usuarios/*
```

Se aplicó desde **IAM → Policies → Create policy → JSON** y se adjuntó a `mingo-agente` desde **Users → mingo-agente → Add permissions → Attach policies directly** con el nombre `MingoS3CleanupDev`. No permite `s3:GetObject`, por lo que la verificación del contenido se hizo por metadatos y el objeto temporal se identificó por prefijo y tamaño. El agente no creó ni adjuntó la política.

Alternativa como política inline con los mismos permisos (no customer managed):

```bash
aws iam put-user-policy \
  --user-name mingo-agente \
  --policy-name MingoS3CleanupDev \
  --policy-document file://infra/iam/mingo-s3-cleanup-dev.json \
  --profile <administrador> \
  --region us-east-1
```

La política fue aplicada por el administrador. Tras ella, la limpieza E2E borró el objeto temporal pendiente; las ejecuciones posteriores terminaron con `CLEANUP_S3_OK` y sin objetos `usuarios/*` recientes.

## Verificación posterior con `mingo-agente`

`mingo-agente` no puede listar ni leer políticas IAM, así que la verificación es funcional:

- `s3:PutObject` en `tmp/artifacts/*` → ya comprobado.
- `ce:GetCostAndUsage` → ya comprobado.
- `cloudformation:ContinueUpdateRollback` → ya comprobado; la recuperación terminó en `UPDATE_ROLLBACK_COMPLETE`.
- `iam:PassRole` y `s3:GetObject` → comprobados; el changeset de sincronización terminó en `UPDATE_COMPLETE`.
- `s3:DeleteObject` en `usuarios/*` → comprobado; la limpieza E2E terminó sin objetos temporales.

Consulta de gasto:

```bash
aws ce get-cost-and-usage \
  --time 'Start=2026-11-01,End=2026-11-26' \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --profile mingo-agente \
  --region us-east-1
```

Estado del despliegue: `aws cloudformation package` y los changesets de código y configuración se ejecutaron. El primer changeset falló por los permisos descritos en la sección 3; el código de las Lambda quedó correcto. La recuperación terminó en `UPDATE_ROLLBACK_COMPLETE` con las tres Lambda omitidas y, tras aplicar la política de la sección 4, el changeset `roles-docente-sync-20261125` dejó el stack en `UPDATE_COMPLETE` sin deriva. Los changesets posteriores (`restore-secrets-20261125`, `materia-rls-fix-20261125`, `e2e-repo-fix-20261125-safe`, `e2e-worker-fix-20261125` y `e2e-chat-model-fix-20261125`) también terminaron en `UPDATE_COMPLETE`. `/api/health` y el frontend responden `200`; el E2E completo pasó y el costo de noviembre es `-0.0000000002 USD` unblended.
