import {
  exerciseSchema,
  filterExercises,
  type Exercise,
  type ExerciseQuery,
} from '@ai-coach/shared';
import { AppError } from '../../lib/http.js';
import { ExerciseModel } from './exercise.model.js';

export interface ExerciseService {
  list(query: ExerciseQuery): Promise<Exercise[]>;
  get(slug: string): Promise<Exercise>;
  /** Throws 400 when any id is not in the library (plans and logs may only use known exercises). */
  assertExist(ids: readonly number[]): Promise<void>;
}

export function toExercise(row: ExerciseModel): Exercise {
  return exerciseSchema.parse({
    id: row.id,
    slug: row.slug,
    name: row.name,
    muscleGroup: row.muscleGroup,
    secondaryMuscles: row.secondaryMuscles,
    equipment: row.equipment,
    level: row.level,
    description: row.description,
    steps: JSON.parse(row.steps) as unknown,
    mistakes: JSON.parse(row.mistakes) as unknown,
    cameraSupported: Boolean(row.cameraSupported),
    defaultSets: row.defaultSets,
    defaultReps: row.defaultReps,
    restSeconds: row.restSeconds,
  });
}

/** The library is ~40 seeded rows that rarely change, so it is read once and filtered in memory. */
export function createExerciseService(): ExerciseService {
  let cache: Promise<Exercise[]> | null = null;
  const all = () => {
    cache ??= ExerciseModel.findAll({ order: [['id', 'ASC']] })
      .then((rows) => rows.map(toExercise))
      .catch((err: unknown) => {
        cache = null;
        throw err;
      });
    return cache;
  };

  return {
    async list(query) {
      return filterExercises(await all(), query);
    },
    async get(slug) {
      const found = (await all()).find((e) => e.slug === slug);
      if (!found) throw new AppError(404, 'EXERCISE_NOT_FOUND', 'Không tìm thấy bài tập');
      return found;
    },
    async assertExist(ids) {
      const known = new Set((await all()).map((e) => e.id));
      if (ids.some((id) => !known.has(id))) {
        throw new AppError(400, 'UNKNOWN_EXERCISE', 'Có bài tập không nằm trong thư viện');
      }
    },
  };
}
