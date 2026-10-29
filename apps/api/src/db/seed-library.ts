import { createRequire } from 'node:module';
import { exerciseSchema, type Exercise } from '@ai-coach/shared';

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
const { EXERCISES } = require('./seeders/20261030000000-exercises.cjs') as {
  EXERCISES: SeedRow[];
};

/** The 40 seeded exercises as API objects, without a database (tests and the LLM benchmark). */
export const SEEDED_LIBRARY: Exercise[] = EXERCISES.map((r, i) =>
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
