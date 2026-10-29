import { Router, type RequestHandler } from 'express';
import { createExerciseController } from './exercise.controller.js';
import type { ExerciseService } from './exercise.service.js';

export function createExerciseRouter(
  exercises: ExerciseService,
  requireAuth: RequestHandler,
): Router {
  const c = createExerciseController(exercises);
  const router = Router();
  router.get('/exercises', requireAuth, c.list);
  router.get('/exercises/:slug', requireAuth, c.get);
  return router;
}
