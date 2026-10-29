import {
  DAYS,
  planSchema,
  sessionSchema,
  type Plan,
  type Session,
  type SessionInput,
} from '@ai-coach/shared';
import type { Sequelize, Transaction } from 'sequelize';
import { AppError } from '../../lib/http.js';
import { ExerciseModel } from '../exercises/exercise.model.js';
import type { ExerciseService } from '../exercises/exercise.service.js';
import { WorkoutLogModel } from '../workouts/workout.model.js';
import { PlanModel, PlanSessionExerciseModel, PlanSessionModel } from './plan.model.js';

export interface PlanService {
  getWeek(userId: number, weekStart: string): Promise<Plan>;
  createWeek(userId: number, weekStart: string): Promise<Plan>;
  getSession(userId: number, sessionId: number): Promise<Session>;
  addSession(userId: number, planId: number, input: SessionInput): Promise<Session>;
  updateSession(userId: number, sessionId: number, input: SessionInput): Promise<Session>;
  deleteSession(userId: number, sessionId: number): Promise<void>;
  setCompleted(userId: number, sessionId: number, completed: boolean): Promise<Session>;
  /** Used by workout logging: marks the session done inside the caller's transaction. */
  completeOwned(userId: number, sessionId: number, at: Date, t: Transaction): Promise<void>;
  /** Used by the AI coach: swaps the whole week for generated sessions. */
  replaceWeek(
    userId: number,
    weekStart: string,
    source: 'ai' | 'template',
    aiNote: string,
    sessions: SessionInput[],
  ): Promise<Plan>;
}

const NOT_FOUND = () => new AppError(404, 'NOT_FOUND', 'Không tìm thấy buổi tập');

const sessionInclude = [
  {
    model: PlanSessionExerciseModel,
    as: 'items',
    include: [{ model: ExerciseModel, as: 'exercise' }],
  },
];

export function toSession(row: PlanSessionModel): Session {
  const items = [...(row.items ?? [])].sort((a, b) => a.position - b.position);
  return sessionSchema.parse({
    id: row.id,
    planId: row.planId,
    day: row.day,
    title: row.title,
    durationMin: row.durationMin,
    notes: row.notes,
    completedAt: row.completedAt ? row.completedAt.toISOString() : null,
    exercises: items.map((i) => ({
      id: i.id,
      exerciseId: i.exerciseId,
      sets: i.sets,
      reps: i.reps,
      weightKg: i.weightKg === null ? null : Number(i.weightKg),
      restSeconds: i.restSeconds,
      exercise: {
        id: i.exercise?.id,
        slug: i.exercise?.slug,
        name: i.exercise?.name,
        muscleGroup: i.exercise?.muscleGroup,
        cameraSupported: Boolean(i.exercise?.cameraSupported),
      },
    })),
  });
}

function toPlan(row: PlanModel): Plan {
  const order = (day: string) => DAYS.indexOf(day as (typeof DAYS)[number]);
  return planSchema.parse({
    id: row.id,
    weekStart: row.weekStart,
    source: row.source,
    aiNote: row.aiNote ?? null,
    sessions: [...(row.sessions ?? [])]
      .sort((a, b) => order(a.day) - order(b.day) || a.id - b.id)
      .map(toSession),
  });
}

export function createPlanService(sequelize: Sequelize, exercises: ExerciseService): PlanService {
  async function ownedSession(userId: number, sessionId: number, t?: Transaction) {
    const row = await PlanSessionModel.findByPk(sessionId, {
      include: [{ model: PlanModel, as: 'plan', attributes: ['userId'] }, ...sessionInclude],
      transaction: t,
    });
    if (!row || row.plan?.userId !== userId) throw NOT_FOUND();
    return row;
  }

  async function reload(sessionId: number, t?: Transaction) {
    const row = await PlanSessionModel.findByPk(sessionId, {
      include: sessionInclude,
      transaction: t,
    });
    if (!row) throw NOT_FOUND();
    return toSession(row);
  }

  async function writeItems(sessionId: number, input: SessionInput, t: Transaction) {
    await PlanSessionExerciseModel.destroy({ where: { sessionId }, transaction: t });
    await PlanSessionExerciseModel.bulkCreate(
      input.exercises.map((e, position) => ({ ...e, sessionId, position })),
      { transaction: t },
    );
  }

  async function findWeek(userId: number, weekStart: string, t?: Transaction) {
    return PlanModel.findOne({
      where: { userId, weekStart },
      include: [{ model: PlanSessionModel, as: 'sessions', include: sessionInclude }],
      transaction: t,
    });
  }

  return {
    async getWeek(userId, weekStart) {
      const row = await findWeek(userId, weekStart);
      if (!row) throw new AppError(404, 'PLAN_NOT_FOUND', 'Chưa có lịch tập cho tuần này');
      return toPlan(row);
    },

    async createWeek(userId, weekStart) {
      if (await PlanModel.findOne({ where: { userId, weekStart } })) {
        throw new AppError(409, 'PLAN_EXISTS', 'Tuần này đã có lịch tập');
      }
      const row = await PlanModel.create({ userId, weekStart, source: 'manual' });
      return toPlan(Object.assign(row, { sessions: [] }));
    },

    async getSession(userId, sessionId) {
      return toSession(await ownedSession(userId, sessionId));
    },

    async addSession(userId, planId, input) {
      const plan = await PlanModel.findByPk(planId);
      if (!plan || plan.userId !== userId)
        throw new AppError(404, 'PLAN_NOT_FOUND', 'Không tìm thấy lịch tập');
      await exercises.assertExist(input.exercises.map((e) => e.exerciseId));
      return sequelize.transaction(async (t) => {
        const row = await PlanSessionModel.create(
          {
            planId,
            day: input.day,
            title: input.title,
            durationMin: input.durationMin,
            notes: input.notes,
          },
          { transaction: t },
        );
        await writeItems(row.id, input, t);
        return reload(row.id, t);
      });
    },

    async updateSession(userId, sessionId, input) {
      await exercises.assertExist(input.exercises.map((e) => e.exerciseId));
      return sequelize.transaction(async (t) => {
        const row = await ownedSession(userId, sessionId, t);
        await row.update(
          {
            day: input.day,
            title: input.title,
            durationMin: input.durationMin,
            notes: input.notes,
          },
          { transaction: t },
        );
        await writeItems(sessionId, input, t);
        return reload(sessionId, t);
      });
    },

    async deleteSession(userId, sessionId) {
      await sequelize.transaction(async (t) => {
        const row = await ownedSession(userId, sessionId, t);
        // Keep the workout history; it simply no longer points at a planned session.
        await WorkoutLogModel.update({ sessionId: null }, { where: { sessionId }, transaction: t });
        await row.destroy({ transaction: t });
      });
    },

    async setCompleted(userId, sessionId, completed) {
      const row = await ownedSession(userId, sessionId);
      await row.update({ completedAt: completed ? new Date() : null });
      return reload(sessionId);
    },

    async completeOwned(userId, sessionId, at, t) {
      const row = await ownedSession(userId, sessionId, t);
      await row.update({ completedAt: at }, { transaction: t });
    },

    async replaceWeek(userId, weekStart, source, aiNote, sessions) {
      await exercises.assertExist(sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)));
      return sequelize.transaction(async (t) => {
        let plan = await PlanModel.findOne({ where: { userId, weekStart }, transaction: t });
        if (plan) {
          const old = (
            await PlanSessionModel.findAll({
              where: { planId: plan.id },
              attributes: ['id'],
              transaction: t,
            })
          ).map((r) => r.id);
          if (old.length) {
            await WorkoutLogModel.update(
              { sessionId: null },
              { where: { sessionId: old }, transaction: t },
            );
            await PlanSessionModel.destroy({ where: { planId: plan.id }, transaction: t });
          }
          await plan.update({ source, aiNote }, { transaction: t });
        } else {
          plan = await PlanModel.create({ userId, weekStart, source, aiNote }, { transaction: t });
        }
        for (const input of sessions) {
          const row = await PlanSessionModel.create(
            {
              planId: plan.id,
              day: input.day,
              title: input.title,
              durationMin: input.durationMin,
              notes: input.notes,
            },
            { transaction: t },
          );
          await writeItems(row.id, input, t);
        }
        const fresh = await findWeek(userId, weekStart, t);
        if (!fresh) throw new AppError(500, 'INTERNAL', 'Đã có lỗi xảy ra, vui lòng thử lại');
        return toPlan(fresh);
      });
    },
  };
}
