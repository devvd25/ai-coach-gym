import { weightInputSchema, workoutInputSchema } from '@ai-coach/shared';
import { Router, type RequestHandler } from 'express';
import { validateBody } from '../../lib/http.js';
import { createWeightController } from './weight.controller.js';
import type { WeightService } from './weight.service.js';
import { createWorkoutController } from './workout.controller.js';
import type { WorkoutService } from './workout.service.js';

export function createWorkoutRouter(
  workouts: WorkoutService,
  weights: WeightService,
  requireAuth: RequestHandler,
): Router {
  const w = createWorkoutController(workouts);
  const kg = createWeightController(weights);
  const router = Router();
  router.use(['/workouts', '/weights'], requireAuth);
  router.get('/workouts', w.list);
  router.post('/workouts', validateBody(workoutInputSchema), w.create);
  router.get('/workouts/:id', w.get);
  router.get('/weights', kg.list);
  router.put('/weights/:date', validateBody(weightInputSchema), kg.upsert);
  router.delete('/weights/:date', kg.remove);
  return router;
}
