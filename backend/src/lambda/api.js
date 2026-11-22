/**
 * Handler de la API HTTP de MINGO en Lambda.
 * serverless-http adapta el evento de API Gateway HTTP API a una solicitud
 * de Express y convierte la respuesta al formato que espera API Gateway.
 */
const serverless = require('serverless-http');
const app = require('../app');

/** @type {(evento: object, contexto: object) => Promise<object>} */
const handler = serverless(app);

module.exports = { handler };
