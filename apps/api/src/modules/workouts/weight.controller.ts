import { addDays, isoDateSchema, toIsoDate, type WeightEntry } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError, parseQuery, userIdOf } from '../../lib/http.js';
import type { WeightService } from './weight.service.js';

const dateParam = z.object({ date: isoDateSchema });
const listQuery = z.object({ days: z.coerce.number().int().min(7).max(730).default(180) });

function measuredDate(raw: unknown): string {
  const { date } = parseQuery(dateParam, raw);
  // Allow tomorrow to absorb timezone differences between browser and server.
  if (date > addDays(toIsoDate(new Date()), 1)) {
    throw new AppError(400, 'VALIDATION', 'Không thể ghi cân nặng cho ngày trong tương lai');
  }
  return date;
}

export function createWeightController(weights: WeightService) {
  const list: RequestHandler = async (req, res) => {
    const { days } = parseQuery(listQuery, req.query);
    res.json(await weights.list(userIdOf(res), addDays(toIsoDate(new Date()), -days)));
  };
  const upsert: RequestHandler = async (req, res) => {
    const body = req.body as Omit<WeightEntry, 'date'>;
    res.json(
      await weights.upsert(userIdOf(res), measuredDate(req.params), body.weightKg, body.note),
    );
  };
  const remove: RequestHandler = async (req, res) => {
    await weights.remove(userIdOf(res), measuredDate(req.params));
    res.status(204).end();
  };
  return { list, upsert, remove };
}
