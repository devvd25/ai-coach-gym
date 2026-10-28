import { Router } from 'express';
import { createHealthController } from './health.controller.js';
import type { HealthService } from './health.service.js';

export function createHealthRouter(service: HealthService): Router {
  const router = Router();
  router.get('/health', createHealthController(service));
  return router;
}
