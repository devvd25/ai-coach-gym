import { addDays, authResponseSchema, toIsoDate, type SessionInput } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';

type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

async function signedIn() {
  app = await startTestApp();
  const res = await app.call('POST', '/api/auth/register', {
    fullName: 'Người dùng',
    email: 'u@email.com',
    password: 'Squat2026',
    acceptTerms: true,
  });
  return { app, token: authResponseSchema.parse(res.body).token, userId: 1 };
}

const session: SessionInput = {
  day: 'wed',
  title: 'Thân dưới A',
  durationMin: 50,
  notes: '',
  exercises: [{ exerciseId: 1, sets: 4, reps: '8', weightKg: 60, restSeconds: 120 }],
};

describe('training routes require a login', () => {
  it.each([
    ['GET', '/api/exercises'],
    ['GET', '/api/plans/week/2026-10-26'],
    ['POST', '/api/plans'],
    ['PUT', '/api/sessions/1'],
    ['GET', '/api/workouts'],
    ['PUT', '/api/weights/2026-10-28'],
  ])('%s %s → 401', async (method, path) => {
    app = await startTestApp();
    expect((await app.call(method, path, method === 'GET' ? undefined : {})).status).toBe(401);
    expect(app.calls).toEqual([]);
  });
});

describe('exercise library', () => {
  it('passes parsed filters to the service and rejects unknown values', async () => {
    const { app, token } = await signedIn();
    expect(
      (await app.call('GET', '/api/exercises?muscle=legs&q=squat&equipment=', undefined, token))
        .status,
    ).toBe(200);
    expect(app.calls.at(-1)).toEqual({
      fn: 'exercises.list',
      args: [{ muscle: 'legs', q: 'squat' }],
    });
    expect((await app.call('GET', '/api/exercises?muscle=neck', undefined, token)).status).toBe(
      400,
    );
  });
});

describe('plans and sessions', () => {
  it('only accepts Monday week starts', async () => {
    const { app, token } = await signedIn();
    expect((await app.call('GET', '/api/plans/week/2026-10-27', undefined, token)).status).toBe(
      400,
    );
    expect((await app.call('POST', '/api/plans', { weekStart: '2026-10-28' }, token)).status).toBe(
      400,
    );
    expect((await app.call('POST', '/api/plans', { weekStart: '2026-10-26' }, token)).status).toBe(
      201,
    );
    expect(app.calls.at(-1)).toEqual({ fn: 'plans.createWeek', args: [1, '2026-10-26'] });
  });

  it('validates session bodies and scopes calls to the signed-in user', async () => {
    const { app, token } = await signedIn();
    const bad = await app.call(
      'POST',
      '/api/plans/7/sessions',
      { ...session, exercises: [] },
      token,
    );
    expect(bad.status).toBe(400);
    expect(bad.body).toMatchObject({ error: { fields: { exercises: expect.any(String) } } });
    expect((await app.call('POST', '/api/plans/7/sessions', session, token)).status).toBe(201);
    expect(app.calls.at(-1)).toEqual({ fn: 'plans.addSession', args: [1, 7, session] });
  });

  it('treats a non-numeric id as not found and deletes with 204', async () => {
    const { app, token } = await signedIn();
    expect((await app.call('GET', '/api/sessions/abc', undefined, token)).status).toBe(404);
    const res = await fetch(`${app.base}/api/sessions/3`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.status).toBe(204);
    expect(app.calls.at(-1)).toEqual({ fn: 'plans.deleteSession', args: [1, 3] });
  });
});

describe('workouts and weights', () => {
  it('rejects a workout that ends before it starts', async () => {
    const { app, token } = await signedIn();
    const res = await app.call(
      'POST',
      '/api/workouts',
      {
        sessionId: null,
        title: 'Buổi tự do',
        startedAt: '2026-10-28T18:00:00+07:00',
        finishedAt: '2026-10-28T17:00:00+07:00',
        notes: '',
        feeling: 'right',
        sets: [{ exerciseId: 1, setNumber: 1, reps: 8, weightKg: 60, rpe: 7 }],
      },
      token,
    );
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: { fields: { finishedAt: expect.any(String) } } });
  });

  it('stores weight by date but refuses dates in the future', async () => {
    const { app, token } = await signedIn();
    const today = toIsoDate(new Date());
    const ok = await app.call('PUT', `/api/weights/${today}`, { weightKg: 68.4, note: '' }, token);
    expect(ok.status).toBe(200);
    expect(app.calls.at(-1)).toEqual({ fn: 'weights.upsert', args: [1, today, 68.4, ''] });
    const future = await app.call(
      'PUT',
      `/api/weights/${addDays(today, 5)}`,
      { weightKg: 68, note: '' },
      token,
    );
    expect(future.status).toBe(400);
    expect(
      (await app.call('PUT', `/api/weights/${today}`, { weightKg: 10, note: '' }, token)).status,
    ).toBe(400);
  });
});
