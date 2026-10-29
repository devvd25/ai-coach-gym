import { z } from 'zod';

export const POSE_MODEL_NAMES = ['lite', 'full'] as const;

/** Result of one camera squat set. Only numbers are stored, never video or landmarks. */
export const squatSessionInputSchema = z.object({
  startedAt: z.iso.datetime({ offset: true }),
  durationSec: z
    .number()
    .int()
    .min(1)
    .max(2 * 60 * 60),
  repCount: z.number().int().min(0).max(1000),
  /** Average of the deepest knee angle of each rep (degrees); null when no rep was counted. */
  avgMinKneeAngle: z.number().min(0).max(180).nullable(),
  model: z.enum(POSE_MODEL_NAMES),
  avgFps: z.number().min(0).max(240).nullable(),
});

export const squatSessionSchema = squatSessionInputSchema.extend({ id: z.number().int() });
export const squatSessionListSchema = z.array(squatSessionSchema);

export type SquatSessionInput = z.infer<typeof squatSessionInputSchema>;
export type SquatSession = z.infer<typeof squatSessionSchema>;
