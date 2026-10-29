import {
  chatRequestSchema,
  generateNutritionSchema,
  generatePlanSchema,
  reviewRequestSchema,
} from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { rateLimit } from 'express-rate-limit';
import { userIdOf, validateBody } from '../../lib/http.js';
import { createAiController } from './ai.controller.js';
import type { AiService } from './ai.service.js';

export function createAiRouter(
  ai: AiService,
  requireAuth: RequestHandler,
  requestsPerHour: number,
): Router {
  const c = createAiController(ai);
  // Each generation keeps the GPU busy for seconds, so the limit is per user, not per IP.
  const limiter = rateLimit({
    windowMs: 60 * 60_000,
    limit: requestsPerHour,
    keyGenerator: (_req, res) => `user:${userIdOf(res)}`,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: {
      error: {
        code: 'RATE_LIMITED',
        message: `Bạn đã dùng hết ${requestsPerHour} lượt AI trong 1 giờ. Vui lòng thử lại sau.`,
      },
    },
  });

  const router = Router();
  router.use(['/ai', '/nutrition'], requireAuth);
  router.post('/ai/plan', limiter, validateBody(generatePlanSchema), c.generatePlan);
  router.post('/ai/nutrition', limiter, validateBody(generateNutritionSchema), c.generateNutrition);
  router.post('/ai/review', limiter, validateBody(reviewRequestSchema), c.review);
  router.post('/ai/chat', limiter, validateBody(chatRequestSchema), c.chat);
  router.get('/ai/requests', c.listRequests);
  router.get('/ai/status', c.status);
  router.get('/nutrition/:date', c.getNutrition);
  return router;
}
