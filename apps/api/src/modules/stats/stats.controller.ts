import { dashboardQuerySchema } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { parseQuery, userIdOf } from '../../lib/http.js';
import type { StatsService } from './stats.service.js';

export function createStatsController(stats: StatsService) {
  const dashboard: RequestHandler = async (req, res) => {
    const { weeks } = parseQuery(dashboardQuerySchema, req.query);
    res.json(await stats.dashboard(userIdOf(res), weeks));
  };
  return { dashboard };
}
