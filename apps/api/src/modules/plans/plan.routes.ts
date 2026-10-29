import { completionSchema, createPlanSchema, sessionInputSchema } from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../lib/http.js';
import { createPlanController } from './plan.controller.js';
import type { PlanService } from './plan.service.js';

export function createPlanRouter(plans: PlanService, requireAuth: RequestHandler): Router {
  const c = createPlanController(plans);
  const router = Router();
  router.use(['/plans', '/sessions'], requireAuth);
  router.get('/plans/week/:weekStart', c.getWeek);
  router.post('/plans', validateBody(createPlanSchema), c.createWeek);
  router.post('/plans/:id/sessions', validateBody(sessionInputSchema), c.addSession);
  router.get('/sessions/:id', c.getSession);
  router.put('/sessions/:id', validateBody(sessionInputSchema), c.updateSession);
  router.delete('/sessions/:id', c.deleteSession);
  router.put('/sessions/:id/completion', validateBody(completionSchema), c.setCompletion);
  return router;
}
