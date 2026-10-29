import {
  completionSchema,
  createPlanSchema,
  weekStartSchema,
  type SessionInput,
} from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { idParam, parseQuery, userIdOf } from '../../lib/http.js';
import type { PlanService } from './plan.service.js';

const weekParam = z.object({ weekStart: weekStartSchema });

export function createPlanController(plans: PlanService) {
  const getWeek: RequestHandler = async (req, res) => {
    const { weekStart } = parseQuery(weekParam, req.params);
    res.json(await plans.getWeek(userIdOf(res), weekStart));
  };
  const createWeek: RequestHandler = async (req, res) => {
    const { weekStart } = createPlanSchema.parse(req.body);
    res.status(201).json(await plans.createWeek(userIdOf(res), weekStart));
  };
  const getSession: RequestHandler = async (req, res) => {
    res.json(await plans.getSession(userIdOf(res), idParam(req.params.id)));
  };
  const addSession: RequestHandler = async (req, res) => {
    const session = await plans.addSession(
      userIdOf(res),
      idParam(req.params.id),
      req.body as SessionInput,
    );
    res.status(201).json(session);
  };
  const updateSession: RequestHandler = async (req, res) => {
    res.json(
      await plans.updateSession(userIdOf(res), idParam(req.params.id), req.body as SessionInput),
    );
  };
  const deleteSession: RequestHandler = async (req, res) => {
    await plans.deleteSession(userIdOf(res), idParam(req.params.id));
    res.status(204).end();
  };
  const setCompletion: RequestHandler = async (req, res) => {
    const { completed } = completionSchema.parse(req.body);
    res.json(await plans.setCompleted(userIdOf(res), idParam(req.params.id), completed));
  };
  return {
    getWeek,
    createWeek,
    getSession,
    addSession,
    updateSession,
    deleteSession,
    setCompletion,
  };
}
