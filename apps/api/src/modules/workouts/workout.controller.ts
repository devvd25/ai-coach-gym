import type { WorkoutInput } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { idParam, parseQuery, userIdOf } from '../../lib/http.js';
import type { WorkoutService } from './workout.service.js';

const listQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createWorkoutController(workouts: WorkoutService) {
  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await workouts.create(userIdOf(res), req.body as WorkoutInput));
  };
  const list: RequestHandler = async (req, res) => {
    const { days, limit } = parseQuery(listQuery, req.query);
    const from = days ? new Date(Date.now() - days * 86_400_000) : undefined;
    res.json(await workouts.list(userIdOf(res), { from, limit }));
  };
  const get: RequestHandler = async (req, res) => {
    res.json(await workouts.get(userIdOf(res), idParam(req.params.id)));
  };
  return { create, list, get };
}
