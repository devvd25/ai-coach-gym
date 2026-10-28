import { profileSchema } from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../lib/http.js';
import { createProfileController } from './profile.controller.js';
import type { ProfileService } from './profile.service.js';

export function createProfileRouter(profiles: ProfileService, requireAuth: RequestHandler): Router {
  const c = createProfileController(profiles);
  const router = Router();
  router.get('/profile', requireAuth, c.get);
  router.put('/profile', requireAuth, validateBody(profileSchema), c.save);
  return router;
}
