import cors from 'cors';
import express, { type ErrorRequestHandler, type Express } from 'express';
import helmet from 'helmet';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';

export interface AppDeps {
  webOrigin: string;
  health: HealthService;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.webOrigin }));
  app.use(express.json({ limit: '100kb' }));

  app.use(createHealthRouter(deps.health));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } });
  });

  const onError: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
    console.error(err instanceof Error ? err.message : err);
    res
      .status(500)
      .json({ error: { code: 'INTERNAL', message: 'Đã có lỗi xảy ra, vui lòng thử lại' } });
  };
  app.use(onError);

  return app;
}
