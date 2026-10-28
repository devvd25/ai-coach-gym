import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler } from './lib/http.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { TokenService } from './modules/auth/token.service.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { createProfileRouter } from './modules/profile/profile.routes.js';
import type { ProfileService } from './modules/profile/profile.service.js';

export interface AppDeps {
  webOrigin: string;
  health: HealthService;
  auth: AuthService;
  profiles: ProfileService;
  tokens: TokenService;
  /** Login/register attempts per IP per 15 minutes. */
  authAttemptsPer15Min?: number;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.webOrigin }));
  app.use(express.json({ limit: '100kb' }));

  const auth = requireAuth(deps.tokens);
  app.use(createHealthRouter(deps.health));
  app.use(
    '/api',
    createAuthRouter(deps.auth, {
      requireAuth: auth,
      attemptsPer15Min: deps.authAttemptsPer15Min ?? 10,
    }),
  );
  app.use('/api', createProfileRouter(deps.profiles, auth));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } });
  });
  app.use(errorHandler);

  return app;
}
