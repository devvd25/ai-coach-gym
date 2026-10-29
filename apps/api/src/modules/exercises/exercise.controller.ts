import { exerciseQuerySchema } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { parseQuery } from '../../lib/http.js';
import type { ExerciseService } from './exercise.service.js';

export function createExerciseController(exercises: ExerciseService) {
  const list: RequestHandler = async (req, res) => {
    res.json(await exercises.list(parseQuery(exerciseQuerySchema, req.query)));
  };
  const get: RequestHandler = async (req, res) => {
    res.json(await exercises.get(String(req.params.slug)));
  };
  return { list, get };
}
