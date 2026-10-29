import { z } from 'zod';
import { weekStartSchema } from './dates.js';
import { MUSCLE_GROUPS } from './exercise.js';
import { DAYS } from './profile.js';

export const PLAN_SOURCES = ['manual', 'ai', 'template'] as const;

/** "8", "8-12" (range) or "45s" (timed holds such as planks). */
export const repsSchema = z
  .string()
  .trim()
  .regex(/^(\d{1,3}(-\d{1,3})?|\d{1,3}s)$/, 'Ví dụ: 8, 8-12 hoặc 45s');

export const sessionExerciseInputSchema = z.object({
  exerciseId: z.number().int().positive(),
  sets: z.number().int().min(1, 'Tối thiểu 1 set').max(10, 'Tối đa 10 set'),
  reps: repsSchema,
  weightKg: z.number().min(0).max(500).nullable(),
  restSeconds: z.number().int().min(0).max(600),
});

export const sessionInputSchema = z.object({
  day: z.enum(DAYS),
  title: z.string().trim().min(1, 'Nhập tên buổi tập').max(60, 'Tối đa 60 ký tự'),
  durationMin: z.number().int().min(10, 'Tối thiểu 10 phút').max(180, 'Tối đa 180 phút'),
  notes: z.string().trim().max(300),
  exercises: z
    .array(sessionExerciseInputSchema)
    .min(1, 'Thêm ít nhất 1 bài tập')
    .max(12, 'Tối đa 12 bài mỗi buổi'),
});

export const sessionExerciseSchema = sessionExerciseInputSchema.extend({
  id: z.number().int(),
  exercise: z.object({
    id: z.number().int(),
    slug: z.string(),
    name: z.string(),
    muscleGroup: z.enum(MUSCLE_GROUPS),
    cameraSupported: z.boolean(),
  }),
});

export const sessionSchema = sessionInputSchema.extend({
  id: z.number().int(),
  planId: z.number().int(),
  completedAt: z.iso.datetime({ offset: true }).nullable(),
  exercises: z.array(sessionExerciseSchema),
});

export const planSchema = z.object({
  id: z.number().int(),
  weekStart: weekStartSchema,
  source: z.enum(PLAN_SOURCES),
  /** The AI's explanation of why the plan looks like this (null for manual plans). */
  aiNote: z.string().nullable(),
  sessions: z.array(sessionSchema),
});

export const createPlanSchema = z.object({ weekStart: weekStartSchema });
export const completionSchema = z.object({ completed: z.boolean() });

export type SessionExerciseInput = z.infer<typeof sessionExerciseInputSchema>;
export type SessionInput = z.infer<typeof sessionInputSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Plan = z.infer<typeof planSchema>;

/** Above this the editor warns; M3 safety rules apply the same limit to AI plans. */
export const MAX_SETS_PER_SESSION = 20;

export function totalSets(exercises: readonly { sets: number }[]): number {
  return exercises.reduce((n, e) => n + e.sets, 0);
}
