import { mondayOf, type SessionInput } from '@ai-coach/shared';
import type { Sequelize } from 'sequelize';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { createAiService } from './modules/ai/ai.service.js';
import type { LlmClient } from './modules/ai/llm.service.js';
import { templatePlan } from './modules/ai/templates.js';
import { createExerciseService } from './modules/exercises/exercise.service.js';
import { createPlanService } from './modules/plans/plan.service.js';
import { createProfileService } from './modules/profile/profile.service.js';
import { createSequelizeProfileRepository } from './modules/profile/profile.repository.js';
import { createSquatService } from './modules/squat/squat.service.js';
import { createStatsService } from './modules/stats/stats.service.js';
import { createWeightService } from './modules/workouts/weight.service.js';
import { createWorkoutService } from './modules/workouts/workout.service.js';
import { connectTestDb, createTestUser } from './test/db.js';
import { PROFILE } from './test/library.js';

/**
 * The Sequelize services against a real SQL Server (database ai_coach_test): ownership checks,
 * transactions, cascades and the AI pipeline writing plans and ai_requests.
 */
describe.skipIf(!inject('dbAvailable'))('services on SQL Server', () => {
  let db: Sequelize;
  const exercises = createExerciseService();
  let plans: ReturnType<typeof createPlanService>;
  let workouts: ReturnType<typeof createWorkoutService>;
  const weights = createWeightService();
  const squats = createSquatService();
  let ex: { squat: number; bench: number; plank: number };

  beforeAll(async () => {
    db = connectTestDb();
    plans = createPlanService(db, exercises);
    workouts = createWorkoutService(db, exercises, plans);
    const lib = await exercises.list({});
    const id = (slug: string) => lib.find((e) => e.slug === slug)!.id;
    ex = { squat: id('squat'), bench: id('bench-press'), plank: id('plank') };
  });
  afterAll(() => db?.close());

  const weekStart = mondayOf(new Date());
  const session = (day: SessionInput['day']): SessionInput => ({
    day,
    title: 'Thân dưới',
    durationMin: 60,
    notes: '',
    exercises: [
      { exerciseId: ex.squat, sets: 3, reps: '8', weightKg: 60, restSeconds: 120 },
      { exerciseId: ex.plank, sets: 3, reps: '45s', weightKg: null, restSeconds: 60 },
    ],
  });

  describe('plans', () => {
    it('keeps one plan per week and orders sessions by day', async () => {
      const user = await createTestUser(PROFILE);
      const plan = await plans.createWeek(user, weekStart);
      await expect(plans.createWeek(user, weekStart)).rejects.toMatchObject({ status: 409 });
      await plans.addSession(user, plan.id, session('fri'));
      await plans.addSession(user, plan.id, session('mon'));
      const week = await plans.getWeek(user, weekStart);
      expect(week.sessions.map((s) => s.day)).toEqual(['mon', 'fri']);
      expect(week.sessions[0]!.exercises.map((e) => e.exercise.slug)).toEqual(['squat', 'plank']);
      expect(week.sessions[0]!.exercises[0]!.weightKg).toBe(60);
    });

    it("never exposes or changes another user's sessions", async () => {
      const owner = await createTestUser(PROFILE);
      const other = await createTestUser(PROFILE);
      const plan = await plans.createWeek(owner, weekStart);
      const s = await plans.addSession(owner, plan.id, session('tue'));
      await expect(plans.getSession(other, s.id)).rejects.toMatchObject({ status: 404 });
      await expect(plans.updateSession(other, s.id, session('wed'))).rejects.toMatchObject({
        status: 404,
      });
      await expect(plans.deleteSession(other, s.id)).rejects.toMatchObject({ status: 404 });
      await expect(plans.addSession(other, plan.id, session('thu'))).rejects.toMatchObject({
        status: 404,
      });
      expect((await plans.getSession(owner, s.id)).day).toBe('tue');
    });

    it('rejects exercises that are not in the library', async () => {
      const user = await createTestUser(PROFILE);
      const plan = await plans.createWeek(user, weekStart);
      const bad = {
        ...session('mon'),
        exercises: [{ ...session('mon').exercises[0]!, exerciseId: 999_999 }],
      };
      await expect(plans.addSession(user, plan.id, bad)).rejects.toMatchObject({ status: 400 });
    });
  });

  describe('workouts', () => {
    it('logging a planned session marks it done, computes volume and counts in the dashboard', async () => {
      const user = await createTestUser(PROFILE);
      const plan = await plans.createWeek(user, weekStart);
      const s = await plans.addSession(user, plan.id, session('mon'));
      await plans.addSession(user, plan.id, session('thu'));
      const started = new Date(Date.now() - 60 * 60_000);
      const w = await workouts.create(user, {
        sessionId: s.id,
        title: s.title,
        startedAt: started.toISOString(),
        finishedAt: new Date().toISOString(),
        notes: '',
        feeling: 'right',
        sets: [
          { exerciseId: ex.squat, setNumber: 1, reps: 8, weightKg: 60, rpe: 7 },
          { exerciseId: ex.squat, setNumber: 2, reps: 8, weightKg: 62.5, rpe: 8 },
          { exerciseId: ex.plank, setNumber: 1, reps: 45, weightKg: null, rpe: null },
        ],
      });
      expect(w.volumeKg).toBe(8 * 60 + 8 * 62.5);
      expect(w.avgRpe).toBe(7.5);
      expect((await plans.getSession(user, s.id)).completedAt).not.toBeNull();

      await weights.upsert(user, weekStart, 68.4, '');
      await weights.upsert(user, weekStart, 68.1, 'cân lại'); // same day replaces
      await squats.create(user, {
        startedAt: new Date().toISOString(),
        durationSec: 80,
        repCount: 12,
        avgMinKneeAngle: 91.27,
        model: 'lite',
        avgFps: 29.94,
      });
      const stats = createStatsService({ plans, workouts, weights, squats });
      const week = (await stats.dashboard(user, 2)).weeks.at(-1)!;
      expect(week).toMatchObject({
        workouts: 1,
        sets: 3,
        volumeKg: 980,
        plannedSessions: 2,
        completedSessions: 1,
        completionPct: 50,
        squatReps: 12,
      });
      expect((await weights.list(user, weekStart)).map((x) => x.weightKg)).toEqual([68.1]);
      expect((await squats.list(user, { limit: 5 }))[0]).toMatchObject({
        avgMinKneeAngle: 91.3,
        avgFps: 29.9,
      });
    });

    it('keeps the workout history when the planned session is deleted, and hides it from others', async () => {
      const user = await createTestUser(PROFILE);
      const other = await createTestUser(PROFILE);
      const plan = await plans.createWeek(user, weekStart);
      const s = await plans.addSession(user, plan.id, session('wed'));
      const w = await workouts.create(user, {
        sessionId: s.id,
        title: 'Buổi',
        startedAt: new Date(Date.now() - 1000).toISOString(),
        finishedAt: new Date().toISOString(),
        notes: '',
        feeling: null,
        sets: [{ exerciseId: ex.bench, setNumber: 1, reps: 5, weightKg: 80, rpe: 9 }],
      });
      await plans.deleteSession(user, s.id);
      expect((await workouts.get(user, w.id)).sessionId).toBeNull();
      await expect(workouts.get(other, w.id)).rejects.toMatchObject({ status: 404 });
      await expect(
        workouts.create(other, {
          sessionId: s.id,
          title: 'x',
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          notes: '',
          feeling: null,
          sets: [{ exerciseId: ex.bench, setNumber: 1, reps: 5, weightKg: 80, rpe: null }],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('AI coach pipeline (fake model, real database)', () => {
    function fakeLlm(reply: (attempt: number) => string): LlmClient & { calls: number } {
      const llm = {
        model: 'fake-model',
        calls: 0,
        async chat() {
          llm.calls++;
          return { content: reply(llm.calls), outputTokens: 42 };
        },
      };
      return llm;
    }

    function aiWith(llm: LlmClient) {
      return createAiService({
        llm,
        profiles: createProfileService(createSequelizeProfileRepository()),
        exercises,
        plans,
        workouts,
        weights,
        think: false,
        timeoutMs: 1000,
        requestsPerHour: 20,
      });
    }

    it('saves a valid model plan as an AI plan and logs the request', async () => {
      const user = await createTestUser(PROFILE);
      const library = await exercises.list({});
      const good = JSON.stringify({ ...templatePlan(PROFILE, library), summary: 'Lý do từ AI' });
      const ai = aiWith(fakeLlm(() => good));
      const { plan, meta } = await ai.generatePlan(user, weekStart);
      expect(plan).toMatchObject({ source: 'ai', aiNote: 'Lý do từ AI' });
      expect(plan.sessions).toHaveLength(PROFILE.sessionsPerWeek);
      expect(meta).toMatchObject({ schemaValid: true, retryCount: 0, usedFallback: false });
      const [logged] = await ai.listRequests(user, 5);
      expect(logged).toMatchObject({
        id: meta.requestId,
        task: 'plan',
        model: 'fake-model',
        usedFallback: false,
      });
    });

    it('replaces an existing week with the template after two bad answers', async () => {
      const user = await createTestUser(PROFILE);
      const plan = await plans.createWeek(user, weekStart);
      await plans.addSession(user, plan.id, session('sun'));
      const llm = fakeLlm(() => '{"summary": "thiếu sessions"}');
      const { plan: replaced, meta } = await aiWith(llm).generatePlan(user, weekStart);
      expect(llm.calls).toBe(2);
      expect(replaced.id).toBe(plan.id);
      expect(replaced.source).toBe('template');
      expect(replaced.sessions.map((s) => s.day)).not.toContain('sun');
      expect(meta).toMatchObject({ schemaValid: false, retryCount: 1, usedFallback: true });
    });

    it('stores nutrition per day and returns it later', async () => {
      const user = await createTestUser(PROFILE);
      const ai = aiWith(fakeLlm(() => 'không phải JSON'));
      const { nutrition } = await ai.generateNutrition(user, '2026-10-29');
      expect(nutrition.source).toBe('template');
      const again = await ai.getNutrition(user, '2026-10-29');
      expect(again.targets).toEqual(nutrition.targets);
      await expect(ai.getNutrition(user, '2026-10-30')).rejects.toMatchObject({ status: 404 });
    });
  });
});
