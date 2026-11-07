/**
 * Clientes de AWS (SDK v3).
 * Las credenciales se resuelven mediante la cadena de proveedores por defecto
 * (variables de entorno, perfil local o rol IAM en produccion).
 */
const { S3Client } = require('@aws-sdk/client-s3');
const { LambdaClient } = require('@aws-sdk/client-lambda');
const { SNSClient } = require('@aws-sdk/client-sns');
const { SchedulerClient } = require('@aws-sdk/client-scheduler');
const { SQSClient } = require('@aws-sdk/client-sqs');
const config = require('./environment');

const credentials =
  config.aws.accessKeyId && config.aws.secretAccessKey
    ? {
        accessKeyId: config.aws.accessKeyId,
        secretAccessKey: config.aws.secretAccessKey,
      }
    : undefined;

const clientConfig = {
  region: config.aws.region,
  ...(credentials ? { credentials } : {}),
};

const s3Client = new S3Client(clientConfig);
const lambdaClient = new LambdaClient(clientConfig);
const snsClient = new SNSClient(clientConfig);
const schedulerClient = new SchedulerClient(clientConfig);
const sqsClient = new SQSClient(clientConfig);

module.exports = {
  s3Client,
  lambdaClient,
  snsClient,
  schedulerClient,
  sqsClient,
};
