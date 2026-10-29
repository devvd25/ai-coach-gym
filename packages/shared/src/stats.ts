import { z } from 'zod';
import { isoDateSchema, weekStartSchema } from './dates.js';

export const DASHBOARD_WEEKS = [4, 8, 12] as const;

export const dashboardQuerySchema = z.object({
  weeks: z.coerce.number().int().min(1).max(26).default(8),
});

/** Everything the dashboard shows for one Monday–Sunday week. */
export const weekStatSchema = z.object({
  weekStart: weekStartSchema,
  workouts: z.number().int(),
  sets: z.number().int(),
  volumeKg: z.number(),
  plannedSessions: z.number().int(),
  completedSessions: z.number().int(),
  /** 0–100; null when the week had no plan. */
  completionPct: z.number().int().nullable(),
  squatSessions: z.number().int(),
  squatReps: z.number().int(),
});

export const dashboardSchema = z.object({
  /** Oldest first, the last entry is the current week. */
  weeks: z.array(weekStatSchema),
  weights: z.array(z.object({ date: isoDateSchema, weightKg: z.number() })),
  squats: z.array(
    z.object({
      startedAt: z.iso.datetime({ offset: true }),
      repCount: z.number().int(),
      avgMinKneeAngle: z.number().nullable(),
    }),
  ),
});

export type WeekStat = z.infer<typeof weekStatSchema>;
export type Dashboard = z.infer<typeof dashboardSchema>;
