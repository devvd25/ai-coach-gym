import { squatSessionInputSchema } from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../lib/http.js';
import type { UserRepository } from '../users/user.repository.js';
import { createSquatController } from './squat.controller.js';
import type { SquatService } from './squat.service.js';

export function createSquatRouter(
  squats: SquatService,
  users: UserRepository,
  requireAuth: RequestHandler,
): Router {
  const c = createSquatController(squats, users);
  const router = Router();
  router.use('/squat-sessions', requireAuth);
  router.get('/squat-sessions', c.list);
  router.post(
    '/squat-sessions',
    c.requireCameraConsent,
    validateBody(squatSessionInputSchema),
    c.create,
  );
  return router;
}
