import { Router, type RequestHandler } from 'express';
import { createStatsController } from './stats.controller.js';
import type { StatsService } from './stats.service.js';

export function createStatsRouter(stats: StatsService, requireAuth: RequestHandler): Router {
  const c = createStatsController(stats);
  const router = Router();
  router.get('/stats/dashboard', requireAuth, c.dashboard);
  return router;
}
