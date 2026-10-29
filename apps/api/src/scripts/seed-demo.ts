/**
 * Demo account with 8 weeks of history (7 full weeks + the current one), for the thesis demo.
 * Re-running deletes and recreates it, so dates always end today. Run with the database up:
 *
 *   pnpm db:seed:demo
 *
 * Login: demo@aicoach.local / Demo2026  (local demo data only, not a real person)
 *
 * Research consent is OFF, so `pnpm ml:export` never mixes this made-up data with real users.
 * No ai_requests rows are created: that table only holds real model calls for the experiments.
 */
import {
  addDays,
  dateOfDay,
  mondayOf,
  parseIsoDate,
  toIsoDate,
  type Exercise,
  type Profile,
  type SessionInput,
} from '@ai-coach/shared';
import { env } from '../config/env.js';
import { initModels } from '../db/models.js';
import { createSequelize } from '../db/sequelize.js';
import { NutritionDayModel } from '../modules/ai/ai.model.js';
import { templateNutrition, templatePlan } from '../modules/ai/templates.js';
import { createPasswordHasher } from '../modules/auth/password.js';
import { createExerciseService } from '../modules/exercises/exercise.service.js';
import { createPlanService } from '../modules/plans/plan.service.js';
import { createSequelizeProfileRepository } from '../modules/profile/profile.repository.js';
import { createSquatService } from '../modules/squat/squat.service.js';
import { UserModel } from '../modules/users/user.model.js';
import { createSequelizeUserRepository } from '../modules/users/user.repository.js';
import { createWeightService } from '../modules/workouts/weight.service.js';
import { createWorkoutService } from '../modules/workouts/workout.service.js';

export const DEMO_EMAIL = 'demo@aicoach.local';
export const DEMO_PASSWORD = 'Demo2026';
const WEEKS = 8;
/** Sessions done in each full past week (target 4): a realistic, slightly uneven adherence. */
const DONE_PER_WEEK = [3, 4, 2, 4, 3, 4, 4];

const PROFILE: Profile = {
  goal: 'muscle_gain',
  sex: 'male',
  age: 22,
  heightCm: 172,
  weightKg: 68,
  level: 'intermediate',
  injuries: '',
  sessionsPerWeek: 4,
  sessionMinutes: 60,
  preferredDays: ['mon', 'tue', 'thu', 'fri'],
  location: 'gym',
  equipment: ['barbell', 'dumbbell', 'machine', 'pullup_bar', 'band', 'bodyweight'],
};

/** Starting loads (kg); progression adds ~2.5% a week. */
const START_KG: Record<string, number> = {
  squat: 60,
  'bench-press': 50,
  'barbell-row': 45,
  'romanian-deadlift': 60,
  'dumbbell-shoulder-press': 14,
  'lat-pulldown': 45,
  'leg-press': 100,
  'leg-curl': 30,
  'hammer-curl': 12,
  'triceps-pushdown': 20,
  'calf-raise': 40,
};
const DEFAULT_KG: Record<string, number | null> = {
  barbell: 40,
  dumbbell: 12,
  machine: 30,
  pullup_bar: null,
  band: null,
  bodyweight: null,
};

/** Deterministic noise so every run produces the same story. */
let seed = 20261029;
const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
const roundTo = (n: number, step: number) => Math.round(n / step) * step;

function load(e: Exercise, week: number): number | null {
  const start = START_KG[e.slug] ?? DEFAULT_KG[e.equipment] ?? null;
  return start === null
    ? null
    : roundTo(start * (1 + 0.025 * week), e.equipment === 'dumbbell' ? 1 : 2.5);
}

function weekSessions(library: readonly Exercise[], week: number): SessionInput[] {
  const bySlug = new Map(library.map((e) => [e.slug, e]));
  return templatePlan(PROFILE, library).sessions.map((s) => ({
    day: s.day,
    title: s.title,
    durationMin: s.durationMin,
    notes: '',
    exercises: s.exercises.map((x) => {
      const e = bySlug.get(x.slug)!;
      return {
        exerciseId: e.id,
        sets: x.sets,
        reps: x.reps,
        weightKg: load(e, week),
        restSeconds: x.restSeconds,
      };
    }),
  }));
}

const sequelize = createSequelize(env);
initModels(sequelize);
const exercises = createExerciseService();
const plans = createPlanService(sequelize, exercises);
const workouts = createWorkoutService(sequelize, exercises, plans);
const weights = createWeightService();
const squats = createSquatService();

try {
  await UserModel.destroy({ where: { email: DEMO_EMAIL } }); // cascades to all demo data
  const users = createSequelizeUserRepository();
  const user = await users.create({
    email: DEMO_EMAIL,
    passwordHash: await createPasswordHasher().hash(DEMO_PASSWORD),
    fullName: 'Nguyễn Minh Demo',
  });
  await users.setConsent(user.id, { camera: true, research: false }, new Date());
  await createSequelizeProfileRepository().upsert(user.id, PROFILE);

  const library = await exercises.list({});
  const today = toIsoDate(new Date());
  const firstWeek = addDays(mondayOf(today), -7 * (WEEKS - 1));
  let workoutCount = 0;

  for (let w = 0; w < WEEKS; w++) {
    const weekStart = addDays(firstWeek, 7 * w);
    const plan = await plans.replaceWeek(
      user.id,
      weekStart,
      'template',
      'Kế hoạch mẫu Upper/Lower 4 buổi cho mục tiêu tăng cơ, trình độ trung bình (dữ liệu demo).',
      weekSessions(library, w),
    );
    const current = w === WEEKS - 1;
    const done = current
      ? plan.sessions.filter((s) => dateOfDay(weekStart, s.day) < today)
      : plan.sessions.slice(0, DONE_PER_WEEK[w]);

    for (const s of done) {
      const start = parseIsoDate(dateOfDay(weekStart, s.day));
      start.setHours(18, 0, 0, 0);
      const sets = s.exercises.flatMap((e) =>
        Array.from({ length: e.sets }, (_, i) => ({
          exerciseId: e.exerciseId,
          setNumber: i + 1,
          reps: Number.parseInt(e.reps, 10) - (i === e.sets - 1 && rand() < 0.4 ? 1 : 0),
          weightKg: e.weightKg,
          rpe: roundTo(7 + i * 0.5 + rand() * 0.8, 0.5),
        })),
      );
      await workouts.create(user.id, {
        sessionId: s.id,
        title: s.title,
        startedAt: start.toISOString(),
        finishedAt: new Date(
          start.getTime() + (s.durationMin + Math.round(rand() * 10)) * 60_000,
        ).toISOString(),
        notes: '',
        feeling: rand() < 0.75 ? 'right' : 'too_hard',
        sets,
      });
      workoutCount++;
    }

    // Weighed on Monday and Thursday; slow gain while bulking.
    for (const [day, extra] of [
      ['mon', 0],
      ['thu', 0.05],
    ] as const) {
      const date = dateOfDay(weekStart, day);
      if (date > today) continue;
      await weights.upsert(
        user.id,
        date,
        Math.round((68 + 0.15 * w + extra + (rand() - 0.5) * 0.4) * 10) / 10,
        '',
      );
    }

    // One camera squat set per week from week 2: more reps, deeper squats over time.
    const squatDay = dateOfDay(weekStart, 'tue');
    if (w >= 1 && squatDay < today) {
      const at = parseIsoDate(squatDay);
      at.setHours(18, 50, 0, 0);
      await squats.create(user.id, {
        startedAt: at.toISOString(),
        durationSec: 55 + w * 6,
        repCount: 9 + w + Math.round(rand() * 2),
        avgMinKneeAngle: Math.round((104 - 2 * w + rand() * 2) * 10) / 10,
        model: 'lite',
        avgFps: Math.round((27 + rand() * 3) * 10) / 10,
      });
    }
  }

  await NutritionDayModel.create({
    userId: user.id,
    date: today,
    source: 'template',
    data: JSON.stringify(templateNutrition(PROFILE)),
  });

  console.log(
    `Đã tạo tài khoản demo ${DEMO_EMAIL} / ${DEMO_PASSWORD}: ${WEEKS} tuần lịch tập, ${workoutCount} buổi đã ghi, ` +
      'cân nặng, Squat camera và thực đơn hôm nay.',
  );
} finally {
  await sequelize.close();
}
