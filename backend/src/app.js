/**
 * Configuracion de la aplicacion Express.
 * Se exporta la app (sin escuchar) para facilitar las pruebas con Supertest.
 */
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const { rateLimit } = require('express-rate-limit');

const config = require('./config/environment');
const apiRouter = require('./routes');
const { notFound, errorMiddleware } = require('./middlewares/error.middleware');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(helmet());
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: '3mb' }));
app.use(express.urlencoded({ extended: true, limit: '3mb' }));

if (!config.isTest) {
  app.use(morgan(config.isProd ? 'combined' : 'dev'));
}

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.corsOrigins.includes('*') || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origen no permitido por CORS: ${origin}`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);

app.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      name: 'MINGO API',
      version: '1.0.0',
      docs: `${config.apiPrefix}/health`,
    },
  });
});

const apiLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  limit: config.rateLimit.max,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => config.isTest,
  message: {
    success: false,
    error: { message: 'Demasiadas solicitudes. Intente nuevamente mas tarde.' },
  },
});

app.use(config.apiPrefix, apiLimiter, apiRouter);

app.use(notFound);
app.use(errorMiddleware);

module.exports = app;
