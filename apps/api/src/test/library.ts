import { createRequire } from 'node:module';
import { exerciseSchema, type Exercise, type Profile } from '@ai-coach/shared';

// [slug, name, muscle, secondary, equipment, level, camera, sets, reps, rest, description, steps, mistakes]
type SeedRow = [
  string,
  string,
  string,
  string,
  string,
  string,
  boolean,
  number,
  string,
  number,
  string,
  string[],
  string[],
];

const require = createRequire(import.meta.url);
const { EXERCISES } = require('../db/seeders/20261030000000-exercises.cjs') as {
  EXERCISES: SeedRow[];
};

/** The seeded exercise library, so rule tests run against the real 40 exercises. */
export const LIBRARY: Exercise[] = EXERCISES.map((r, i) =>
  exerciseSchema.parse({
    id: i + 1,
    slug: r[0],
    name: r[1],
    muscleGroup: r[2],
    secondaryMuscles: r[3],
    equipment: r[4],
    level: r[5],
    cameraSupported: r[6],
    defaultSets: r[7],
    defaultReps: r[8],
    restSeconds: r[9],
    description: r[10],
    steps: r[11],
    mistakes: r[12],
  }),
);

export const PROFILE: Profile = {
  goal: 'muscle_gain',
  sex: 'male',
  age: 22,
  heightCm: 172,
  weightKg: 68,
  level: 'intermediate',
  injuries: '',
  sessionsPerWeek: 4,
  sessionMinutes: 60,
  preferredDays: [],
  location: 'gym',
  equipment: ['barbell', 'dumbbell', 'machine', 'pullup_bar', 'band', 'bodyweight'],
};
