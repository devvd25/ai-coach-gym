import { consentSchema, loginSchema, registerSchema } from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateBody } from '../../lib/http.js';
import { createAuthController } from './auth.controller.js';
import type { AuthService } from './auth.service.js';

export interface AuthRouteOptions {
  requireAuth: RequestHandler;
  /** Attempts per IP per 15 minutes on login and register. */
  attemptsPer15Min: number;
}

export function createAuthRouter(auth: AuthService, opts: AuthRouteOptions): Router {
  const c = createAuthController(auth);
  const limiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: opts.attemptsPer15Min,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: { code: 'RATE_LIMITED', message: 'Bạn thử quá nhiều lần. Vui lòng đợi 15 phút.' },
    },
  });

  const router = Router();
  router.post('/auth/register', limiter, validateBody(registerSchema), c.register);
  router.post('/auth/login', limiter, validateBody(loginSchema), c.login);
  router.get('/auth/me', opts.requireAuth, c.me);
  router.put('/me/consent', opts.requireAuth, validateBody(consentSchema), c.consent);
  return router;
}
