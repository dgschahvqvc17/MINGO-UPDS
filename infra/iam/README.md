# Permisos IAM complementarios para `mingo-agente`

**Estado:** propuesto, no aplicado.
**Cuenta:** `591015654164`.
**Región:** `us-east-1`.
**Costo:** `$0`. No crean recursos nuevos.

Estas políticas corrigen dos limitaciones detectadas durante el despliegue de `dev`:

1. `mingo-agente` no puede subir artefactos de Lambda con `aws cloudformation package`.
2. `mingo-agente` no puede consultar Cost Explorer.

El agente de OpenCode **no crea ni modifica IAM**. Un administrador debe aplicar las políticas con credenciales locales propias. No se usan credenciales root para operar.

## 1. Artefactos de CloudFormation

Archivo: [`mingo-agente-artefactos-dev.json`](mingo-agente-artefactos-dev.json).

Permite subir zips temporales solo a:

```text
s3://mingo-documentos-dev-591015654164/tmp/artifacts/*
```

El bucket ya existe, es privado y tiene lifecycle que expira `tmp/` en 1 día. No se agrega `s3:DeleteObject`, `s3:PutObjectAcl` ni acceso a otros prefijos.

No usar el bucket frontend para artefactos: su política permite `s3:GetObject` a CloudFront con `SourceArn` de la distribución `E3KT1CRPPEGF3B`, por lo que los zips quedarían servidos por CloudFront.

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

## Verificación posterior con `mingo-agente`

Lectura de la política aplicada:

```bash
aws iam get-user-policy \
  --user-name mingo-agente \
  --policy-name MingoPackageArtifactsDev \
  --profile mingo-agente \
  --region us-east-1

aws iam get-user-policy \
  --user-name mingo-agente \
  --policy-name MingoCostExplorerReadonly \
  --profile mingo-agente \
  --region us-east-1
```

Consulta de gasto:

```bash
aws ce get-cost-and-usage \
  --time PeriodStart=2026-11-01 \
  --time PeriodEnd=2026-11-26 \
  --granularity MONTHLY \
  --metrics BlendedCost \
  --profile mingo-agente \
  --region us-east-1
```

Una vez aplicadas, el siguiente paso es repetir `aws cloudformation package` y crear un changeset de solo código para `mingo-hu09-dev`. El changeset no se ejecutará sin confirmación explícita.
