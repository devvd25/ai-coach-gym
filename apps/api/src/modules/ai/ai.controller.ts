import {
  chatRequestSchema,
  generateNutritionSchema,
  generatePlanSchema,
  isoDateSchema,
  reviewRequestSchema,
} from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { parseQuery, userIdOf } from '../../lib/http.js';
import type { AiService } from './ai.service.js';

const dateParam = z.object({ date: isoDateSchema });
const listQuery = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

export function createAiController(ai: AiService) {
  const generatePlan: RequestHandler = async (req, res) => {
    const { weekStart } = generatePlanSchema.parse(req.body);
    res.status(201).json(await ai.generatePlan(userIdOf(res), weekStart));
  };
  const generateNutrition: RequestHandler = async (req, res) => {
    const { date } = generateNutritionSchema.parse(req.body);
    res.status(201).json(await ai.generateNutrition(userIdOf(res), date));
  };
  const getNutrition: RequestHandler = async (req, res) => {
    const { date } = parseQuery(dateParam, req.params);
    res.json(await ai.getNutrition(userIdOf(res), date));
  };
  const review: RequestHandler = async (req, res) => {
    const { weekStart } = reviewRequestSchema.parse(req.body);
    res.json(await ai.review(userIdOf(res), weekStart));
  };
  const chat: RequestHandler = async (req, res) => {
    const { messages } = chatRequestSchema.parse(req.body);
    res.json(await ai.chat(userIdOf(res), messages));
  };
  const listRequests: RequestHandler = async (req, res) => {
    const { limit } = parseQuery(listQuery, req.query);
    res.json(await ai.listRequests(userIdOf(res), limit));
  };
  const status: RequestHandler = (_req, res) => {
    res.json(ai.status());
  };
  return { generatePlan, generateNutrition, getNutrition, review, chat, listRequests, status };
}
