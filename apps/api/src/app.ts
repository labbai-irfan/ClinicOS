import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { pinoHttp } from 'pino-http';
import { env, isTest } from './config/env';
import { logger } from './shared/logger';
import { requestId, globalRateLimit, notFoundHandler, errorHandler } from './middleware';
import { apiV1 } from './modules';

export function createApp(): express.Express {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(
    cors({
      origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()),
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(cookieParser());
  app.use(requestId);
  if (!isTest) {
    app.use(
      pinoHttp({
        logger,
        customProps: (req) => ({ requestId: (req as express.Request).requestId }),
        autoLogging: { ignore: (req) => req.url === '/health' },
      }),
    );
  }
  app.use(globalRateLimit);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/v1', apiV1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
