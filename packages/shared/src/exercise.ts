import { z } from 'zod';
import { EQUIPMENT, LEVELS } from './profile.js';

export const MUSCLE_GROUPS = [
  'legs',
  'glutes',
  'chest',
  'back',
  'shoulders',
  'arms',
  'core',
  'full_body',
] as const;

export const MUSCLE_LABELS: Record<(typeof MUSCLE_GROUPS)[number], string> = {
  legs: 'Chân',
  glutes: 'Mông',
  chest: 'Ngực',
  back: 'Lưng',
  shoulders: 'Vai',
  arms: 'Tay',
  core: 'Core',
  full_body: 'Toàn thân',
};

export const exerciseSchema = z.object({
  id: z.number().int(),
  slug: z.string(),
  name: z.string(),
  muscleGroup: z.enum(MUSCLE_GROUPS),
  secondaryMuscles: z.string(),
  equipment: z.enum(EQUIPMENT),
  level: z.enum(LEVELS),
  description: z.string(),
  steps: z.array(z.string()),
  mistakes: z.array(z.string()),
  cameraSupported: z.boolean(),
  defaultSets: z.number().int(),
  defaultReps: z.string(),
  restSeconds: z.number().int(),
});

export const exerciseListSchema = z.array(exerciseSchema);

export const exerciseQuerySchema = z.object({
  q: z.string().trim().max(60).optional(),
  muscle: z.enum(MUSCLE_GROUPS).optional(),
  equipment: z.enum(EQUIPMENT).optional(),
  level: z.enum(LEVELS).optional(),
});

export type Exercise = z.infer<typeof exerciseSchema>;
export type ExerciseQuery = z.infer<typeof exerciseQuerySchema>;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** Case- and accent-insensitive match, so "squat", "Squát" and "đùi" all find what users expect. */
export function normalizeSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim();
}

export function filterExercises(list: readonly Exercise[], query: ExerciseQuery): Exercise[] {
  const q = query.q ? normalizeSearch(query.q) : '';
  return list.filter(
    (e) =>
      (!query.muscle || e.muscleGroup === query.muscle) &&
      (!query.equipment || e.equipment === query.equipment) &&
      (!query.level || e.level === query.level) &&
      (!q ||
        normalizeSearch(
          `${e.name} ${MUSCLE_LABELS[e.muscleGroup]} ${e.secondaryMuscles} ${e.slug}`,
        ).includes(q)),
  );
}
