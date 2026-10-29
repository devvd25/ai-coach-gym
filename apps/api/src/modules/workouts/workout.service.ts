import {
  averageRpe,
  durationMinutes,
  volumeKg,
  workoutSchema,
  workoutSummarySchema,
  type Workout,
  type WorkoutInput,
  type WorkoutSummary,
} from '@ai-coach/shared';
import { Op, type Sequelize } from 'sequelize';
import { AppError } from '../../lib/http.js';
import { ExerciseModel } from '../exercises/exercise.model.js';
import type { ExerciseService } from '../exercises/exercise.service.js';
import type { PlanService } from '../plans/plan.service.js';
import { WorkoutLogModel, WorkoutSetModel } from './workout.model.js';

export interface WorkoutService {
  create(userId: number, input: WorkoutInput): Promise<Workout>;
  list(userId: number, opts: { from?: Date; limit: number }): Promise<WorkoutSummary[]>;
  get(userId: number, id: number): Promise<Workout>;
}

function setsOf(row: WorkoutLogModel) {
  return [...(row.sets ?? [])]
    .map((s) => ({
      id: s.id,
      exerciseId: s.exerciseId,
      exerciseName: s.exercise?.name ?? '',
      setNumber: s.setNumber,
      reps: s.reps,
      weightKg: s.weightKg === null ? null : Number(s.weightKg),
      rpe: s.rpe === null ? null : Number(s.rpe),
    }))
    .sort((a, b) => a.id - b.id);
}

function toSummary(row: WorkoutLogModel): WorkoutSummary {
  const sets = setsOf(row);
  const startedAt = row.startedAt.toISOString();
  const finishedAt = row.finishedAt.toISOString();
  return workoutSummarySchema.parse({
    id: row.id,
    sessionId: row.sessionId,
    title: row.title,
    startedAt,
    finishedAt,
    durationMin: durationMinutes(startedAt, finishedAt),
    volumeKg: volumeKg(sets),
    setCount: sets.length,
    avgRpe: averageRpe(sets),
    feeling: row.feeling,
  });
}

function toWorkout(row: WorkoutLogModel): Workout {
  return workoutSchema.parse({ ...toSummary(row), notes: row.notes, sets: setsOf(row) });
}

const withSets = (names: boolean) => [
  {
    model: WorkoutSetModel,
    as: 'sets',
    ...(names ? { include: [{ model: ExerciseModel, as: 'exercise', attributes: ['name'] }] } : {}),
  },
];

export function createWorkoutService(
  sequelize: Sequelize,
  exercises: ExerciseService,
  plans: PlanService,
): WorkoutService {
  async function get(userId: number, id: number) {
    const row = await WorkoutLogModel.findOne({ where: { id, userId }, include: withSets(true) });
    if (!row) throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy buổi tập');
    return toWorkout(row);
  }

  return {
    async create(userId, input) {
      await exercises.assertExist([...new Set(input.sets.map((s) => s.exerciseId))]);
      const id = await sequelize.transaction(async (t) => {
        const finishedAt = new Date(input.finishedAt);
        // Logging a planned session also ticks it off in the weekly plan.
        if (input.sessionId) await plans.completeOwned(userId, input.sessionId, finishedAt, t);
        const row = await WorkoutLogModel.create(
          {
            userId,
            sessionId: input.sessionId,
            title: input.title,
            startedAt: new Date(input.startedAt),
            finishedAt,
            notes: input.notes,
            feeling: input.feeling,
          },
          { transaction: t },
        );
        await WorkoutSetModel.bulkCreate(
          input.sets.map((s) => ({ ...s, workoutId: row.id })),
          { transaction: t },
        );
        return row.id;
      });
      return get(userId, id);
    },

    async list(userId, { from, limit }) {
      const rows = await WorkoutLogModel.findAll({
        where: { userId, ...(from ? { startedAt: { [Op.gte]: from } } : {}) },
        include: withSets(false),
        order: [['startedAt', 'DESC']],
        limit,
      });
      return rows.map(toSummary);
    },

    get,
  };
}
