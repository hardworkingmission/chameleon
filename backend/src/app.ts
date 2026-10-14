import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/env';
import { httpLogStream } from './utils/logger';
import { apiRateLimiter } from './middleware/rateLimit.middleware';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.middleware';
import authRoutes from './routes/auth.routes';
import convertRoutes from './routes/convert.routes';
import historyRoutes from './routes/history.routes';
import healthRoutes from './routes/health.routes';
import './auth/passport';

export function createApp() {
  const app = express();
  app.set('trust proxy', env.trustProxyHops);

  app.use(helmet());
  app.use(cors({
    origin: env.corsOrigin,
    credentials: true,
    exposedHeaders: ['Content-Disposition'],
  }));
  app.use(morgan('combined', { stream: httpLogStream }));
  app.use(cookieParser());
  app.use(express.json());
  app.use('/api/health', healthRoutes);
  app.use(apiRateLimiter);
  app.use('/api/auth', authRoutes);
  app.use('/api/convert', convertRoutes);
  app.use('/api/history', historyRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
