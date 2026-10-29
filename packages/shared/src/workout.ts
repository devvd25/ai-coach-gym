import { z } from 'zod';
import { isoDateSchema } from './dates.js';

export const FEELINGS = ['too_easy', 'right', 'too_hard'] as const;
export const FEELING_LABELS: Record<(typeof FEELINGS)[number], string> = {
  too_easy: 'Quá nhẹ',
  right: 'Vừa sức',
  too_hard: 'Quá nặng',
};

export const workoutSetInputSchema = z.object({
  exerciseId: z.number().int().positive(),
  setNumber: z.number().int().min(1).max(20),
  /** Repetitions, or seconds for timed holds. */
  reps: z.number().int().min(0).max(300),
  weightKg: z.number().min(0).max(500).nullable(),
  rpe: z.number().min(1).max(10).multipleOf(0.5).nullable(),
});

export const workoutInputSchema = z
  .object({
    sessionId: z.number().int().positive().nullable(),
    title: z.string().trim().min(1).max(60),
    startedAt: z.iso.datetime({ offset: true }),
    finishedAt: z.iso.datetime({ offset: true }),
    notes: z.string().trim().max(500),
    feeling: z.enum(FEELINGS).nullable(),
    sets: z.array(workoutSetInputSchema).min(1, 'Ghi ít nhất 1 set').max(200),
  })
  .refine((w) => Date.parse(w.finishedAt) >= Date.parse(w.startedAt), {
    path: ['finishedAt'],
    message: 'Thời gian kết thúc phải sau khi bắt đầu',
  });

export const workoutSummarySchema = z.object({
  id: z.number().int(),
  sessionId: z.number().int().nullable(),
  title: z.string(),
  startedAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }),
  durationMin: z.number().int(),
  volumeKg: z.number(),
  setCount: z.number().int(),
  avgRpe: z.number().nullable(),
  feeling: z.enum(FEELINGS).nullable(),
});

export const workoutSchema = workoutSummarySchema.extend({
  notes: z.string(),
  sets: z.array(workoutSetInputSchema.extend({ id: z.number().int(), exerciseName: z.string() })),
});

export const workoutListSchema = z.array(workoutSummarySchema);

export const weightInputSchema = z.object({
  weightKg: z.number({ error: 'Nhập cân nặng' }).min(30, 'Từ 30 kg').max(250, 'Tối đa 250 kg'),
  note: z.string().trim().max(120, 'Tối đa 120 ký tự'),
});

export const weightEntrySchema = weightInputSchema.extend({ date: isoDateSchema });
export const weightListSchema = z.array(weightEntrySchema);

export type WorkoutSetInput = z.infer<typeof workoutSetInputSchema>;
export type WorkoutInput = z.infer<typeof workoutInputSchema>;
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type WeightEntry = z.infer<typeof weightEntrySchema>;

/** Training volume: Σ reps × kg over sets that carry a load (bodyweight/timed sets add 0). */
export function volumeKg(sets: readonly Pick<WorkoutSetInput, 'reps' | 'weightKg'>[]): number {
  return Math.round(sets.reduce((v, s) => v + (s.weightKg ? s.reps * s.weightKg : 0), 0) * 10) / 10;
}

export function averageRpe(sets: readonly Pick<WorkoutSetInput, 'rpe'>[]): number | null {
  const rated = sets.map((s) => s.rpe).filter((r): r is number => r !== null);
  if (rated.length === 0) return null;
  return Math.round((rated.reduce((a, b) => a + b, 0) / rated.length) * 10) / 10;
}

export function durationMinutes(startedAt: string, finishedAt: string): number {
  return Math.max(0, Math.round((Date.parse(finishedAt) - Date.parse(startedAt)) / 60_000));
}
