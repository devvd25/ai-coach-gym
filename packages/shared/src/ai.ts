import { z } from 'zod';
import { isoDateSchema, weekStartSchema, type Day } from './dates.js';
import { planSchema } from './plan.js';

/** plan = weekly plan, nutrition = targets + menu, explain = weekly progress review, chat = Q&A. */
export const AI_TASKS = ['plan', 'nutrition', 'explain', 'chat'] as const;
export type AiTask = (typeof AI_TASKS)[number];

/* ---------- What the model must return (sent to Ollama as JSON Schema) ---------- */

/**
 * Built per user so constrained decoding can only produce what the rules allow: the exercise slug
 * is an enum of the exercises this user may do, the day an enum of their days, and the number of
 * sessions is fixed. Safety rules still re-check everything after parsing.
 */
export function buildAiPlanOutputSchema(opts: {
  slugs: readonly [string, ...string[]];
  days: readonly [Day, ...Day[]];
  sessions: number;
}) {
  return z.object({
    summary: z.string().min(1).max(800),
    sessions: z
      .array(
        z.object({
          day: z.enum(opts.days),
          title: z.string().min(1).max(60),
          durationMin: z.number().int().min(10).max(180),
          exercises: z
            .array(
              z.object({
                slug: z.enum(opts.slugs),
                sets: z.number().int().min(2).max(5),
                reps: z.string().min(1).max(10),
                restSeconds: z.number().int().min(30).max(240),
              }),
            )
            .min(3)
            .max(8),
        }),
      )
      .min(opts.sessions)
      .max(opts.sessions),
  });
}

export interface AiPlanOutput {
  summary: string;
  sessions: {
    day: Day;
    title: string;
    durationMin: number;
    exercises: { slug: string; sets: number; reps: string; restSeconds: number }[];
  }[];
}

export const nutritionTargetsSchema = z.object({
  kcal: z.number().int().min(800).max(6000),
  proteinG: z.number().int().min(0).max(400),
  carbG: z.number().int().min(0).max(900),
  fatG: z.number().int().min(0).max(300),
  waterL: z.number().min(0.5).max(8),
});

export const mealSchema = z.object({
  name: z.string().min(1).max(30),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  dish: z.string().min(1).max(160),
  kcal: z.number().int().min(0).max(2500),
  proteinG: z.number().int().min(0).max(250),
  carbG: z.number().int().min(0).max(500),
  fatG: z.number().int().min(0).max(200),
});

export const aiNutritionOutputSchema = z.object({
  targets: nutritionTargetsSchema,
  meals: z.array(mealSchema).min(3).max(6),
  explanation: z.string().min(1).max(800),
});

/** Weekly review: the numbers are computed by the API, the model only interprets them. */
export const aiReviewOutputSchema = z.object({
  verdict: z.string().min(1).max(600),
  highlights: z.array(z.string().min(1).max(160)).min(1).max(4),
  nextSteps: z.array(z.string().min(1).max(160)).min(1).max(3),
});

export const aiChatOutputSchema = z.object({
  answer: z.string().min(1).max(1500),
  suggestions: z.array(z.string().min(1).max(80)).max(3),
});

export type NutritionTargets = z.infer<typeof nutritionTargetsSchema>;
export type Meal = z.infer<typeof mealSchema>;
export type AiNutritionOutput = z.infer<typeof aiNutritionOutputSchema>;
export type AiReviewOutput = z.infer<typeof aiReviewOutputSchema>;
export type AiChatOutput = z.infer<typeof aiChatOutputSchema>;

/* ---------- API requests and responses ---------- */

export const generatePlanSchema = z.object({ weekStart: weekStartSchema });
export const generateNutritionSchema = z.object({ date: isoDateSchema });
export const reviewRequestSchema = z.object({ weekStart: weekStartSchema });

export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1, 'Nhập câu hỏi').max(1500, 'Tối đa 1.500 ký tự'),
});

export const chatRequestSchema = z.object({
  messages: z
    .array(chatMessageSchema)
    .min(1)
    .max(12)
    .refine((m) => m.at(-1)?.role === 'user', 'Tin nhắn cuối phải là câu hỏi của bạn'),
});

/** How one AI call went; recorded in ai_requests for the experiments. */
export const aiMetaSchema = z.object({
  requestId: z.number().int(),
  model: z.string(),
  promptVersion: z.string(),
  latencyMs: z.number().int(),
  schemaValid: z.boolean(),
  retryCount: z.number().int(),
  violations: z.array(z.string()),
  usedFallback: z.boolean(),
});

export const aiPlanResponseSchema = z.object({ plan: planSchema, meta: aiMetaSchema });

export const nutritionDaySchema = z.object({
  date: isoDateSchema,
  source: z.enum(['ai', 'template']),
  targets: nutritionTargetsSchema,
  meals: z.array(mealSchema),
  explanation: z.string(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const aiNutritionResponseSchema = z.object({
  nutrition: nutritionDaySchema,
  meta: aiMetaSchema,
});

export const weekStatsSchema = z.object({
  weekStart: weekStartSchema,
  plannedSessions: z.number().int(),
  completedSessions: z.number().int(),
  /** 0–100, null when nothing was planned. */
  completionPct: z.number().int().nullable(),
  workouts: z.number().int(),
  totalSets: z.number().int(),
  volumeKg: z.number(),
  avgRpe: z.number().nullable(),
  /** Same numbers for the previous week, to talk about the trend. */
  previousVolumeKg: z.number(),
  previousWorkouts: z.number().int(),
  weightStartKg: z.number().nullable(),
  weightEndKg: z.number().nullable(),
});

export const aiReviewResponseSchema = z.object({
  stats: weekStatsSchema,
  review: aiReviewOutputSchema,
  meta: aiMetaSchema,
});

export const aiChatResponseSchema = aiChatOutputSchema.extend({ meta: aiMetaSchema });

export const aiRequestSchema = z.object({
  id: z.number().int(),
  task: z.enum(AI_TASKS),
  model: z.string(),
  promptVersion: z.string(),
  latencyMs: z.number().int(),
  schemaValid: z.boolean(),
  retryCount: z.number().int(),
  violations: z.array(z.string()),
  usedFallback: z.boolean(),
  error: z.string().nullable(),
  createdAt: z.iso.datetime({ offset: true }),
});

export const aiRequestListSchema = z.array(aiRequestSchema);

export const aiStatusSchema = z.object({
  model: z.string(),
  think: z.boolean(),
  timeoutMs: z.number().int(),
  promptVersions: z.record(z.string(), z.string()),
  requestsPerHour: z.number().int(),
});

export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type AiMeta = z.infer<typeof aiMetaSchema>;
export type WeekStats = z.infer<typeof weekStatsSchema>;
export type AiReviewResponse = z.infer<typeof aiReviewResponseSchema>;
export type NutritionDay = z.infer<typeof nutritionDaySchema>;
export type AiRequest = z.infer<typeof aiRequestSchema>;
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** kcal implied by macros (4/4/9 kcal per gram). */
export function macroKcal(t: Pick<NutritionTargets, 'proteinG' | 'carbG' | 'fatG'>): number {
  return t.proteinG * 4 + t.carbG * 4 + t.fatG * 9;
}
