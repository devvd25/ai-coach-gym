import { authResponseSchema, type SquatSession, type WorkoutSummary } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';
import { buildDashboard } from './stats.aggregate.js';
import { createStatsService } from './stats.service.js';

/** Local time, like the rows coming from the database. */
const at = (date: string, time = '18:00') => new Date(`${date}T${time}:00`).toISOString();

const workout = (date: string, volumeKg: number, setCount = 10): WorkoutSummary => ({
  id: 1,
  sessionId: null,
  title: 'Buổi',
  startedAt: at(date),
  finishedAt: at(date, '19:00'),
  durationMin: 60,
  volumeKg,
  setCount,
  avgRpe: 7,
  feeling: null,
});

const squat = (date: string, repCount: number): SquatSession => ({
  id: 1,
  startedAt: at(date, '07:00'),
  durationSec: 60,
  repCount,
  avgMinKneeAngle: 92,
  model: 'lite',
  avgFps: 30,
});

describe('buildDashboard', () => {
  const dashboard = buildDashboard({
    currentWeek: '2026-10-26',
    weeks: 3,
    workouts: [
      workout('2026-10-12', 1000), // week 1 (Mon)
      workout('2026-10-18', 500, 6), // week 1 (Sun, still the same week)
      workout('2026-10-28', 2000), // week 3
      workout('2026-10-05', 9999), // before the range: ignored
    ],
    plans: [
      { weekStart: '2026-10-12', planned: 4, completed: 3 },
      { weekStart: '2026-10-19', planned: 0, completed: 0 }, // empty plan = no plan
      { weekStart: '2026-10-26', planned: 3, completed: 1 },
    ],
    weights: [
      { date: '2026-10-27', weightKg: 68.1, note: '' },
      { date: '2026-10-13', weightKg: 68.9, note: '' },
      { date: '2026-10-01', weightKg: 70, note: '' }, // before the range
    ],
    squats: [squat('2026-10-20', 12), squat('2026-10-22', 15), squat('2026-10-27', 20)],
  });

  it('returns every week of the range, oldest first, including empty ones', () => {
    expect(dashboard.weeks.map((w) => w.weekStart)).toEqual([
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
  });

  it('sums workouts, volume and squat reps per Monday–Sunday week', () => {
    expect(dashboard.weeks[0]).toMatchObject({ workouts: 2, sets: 16, volumeKg: 1500 });
    expect(dashboard.weeks[1]).toMatchObject({ workouts: 0, squatSessions: 2, squatReps: 27 });
    expect(dashboard.weeks[2]).toMatchObject({ workouts: 1, volumeKg: 2000, squatReps: 20 });
  });

  it('computes plan completion only for weeks that had a plan', () => {
    expect(dashboard.weeks.map((w) => w.completionPct)).toEqual([75, null, 33]);
  });

  it('keeps weight and squat series in the range, sorted by date', () => {
    expect(dashboard.weights.map((w) => w.date)).toEqual(['2026-10-13', '2026-10-27']);
    expect(dashboard.squats.map((s) => s.repCount)).toEqual([12, 15, 20]);
  });
});

describe('stats service', () => {
  it('asks each source for data from the Monday of the first week', async () => {
    const seen: unknown[] = [];
    const stats = createStatsService({
      plans: { weekSummaries: async (...a) => (seen.push(['plans', ...a]), []) },
      workouts: { list: async (...a) => (seen.push(['workouts', ...a]), []) },
      weights: { list: async (...a) => (seen.push(['weights', ...a]), []) },
      squats: { list: async (...a) => (seen.push(['squats', ...a]), []) },
    });
    const d = await stats.dashboard(5, 4, new Date('2026-10-29T10:00:00'));
    expect(d.weeks.map((w) => w.weekStart)).toEqual([
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
      '2026-10-26',
    ]);
    expect(seen).toContainEqual(['plans', 5, '2026-10-05']);
    expect(seen).toContainEqual(['weights', 5, '2026-10-05']);
    expect(seen).toContainEqual([
      'workouts',
      5,
      { from: new Date('2026-10-05T00:00:00'), limit: 1000 },
    ]);
  });
});

describe('GET /api/stats/dashboard', () => {
  let app: Awaited<ReturnType<typeof startTestApp>> | undefined;
  afterEach(() => app?.close());

  it('requires a login and validates the range', async () => {
    app = await startTestApp();
    expect((await app.call('GET', '/api/stats/dashboard')).status).toBe(401);
    const reg = await app.call('POST', '/api/auth/register', {
      fullName: 'Người dùng',
      email: 'u@email.com',
      password: 'Squat2026',
      acceptTerms: true,
    });
    const token = authResponseSchema.parse(reg.body).token;
    expect((await app.call('GET', '/api/stats/dashboard?weeks=99', undefined, token)).status).toBe(
      400,
    );
    const ok = await app.call('GET', '/api/stats/dashboard?weeks=8', undefined, token);
    expect(ok.status).toBe(200);
    expect(ok.body.weeks).toHaveLength(8);
  });
});
