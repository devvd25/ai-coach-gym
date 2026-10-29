import { authResponseSchema, type SquatSessionInput } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';

type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

async function signedIn(camera: boolean) {
  app = await startTestApp();
  const res = await app.call('POST', '/api/auth/register', {
    fullName: 'Người dùng',
    email: 'u@email.com',
    password: 'Squat2026',
    acceptTerms: true,
  });
  const token = authResponseSchema.parse(res.body).token;
  await app.call(
    'PUT',
    '/api/me/consent',
    { profileData: true, trainingLogs: true, camera, research: false },
    token,
  );
  return { app, token };
}

const result: SquatSessionInput = {
  startedAt: '2026-10-29T08:00:00.000Z',
  durationSec: 95,
  repCount: 12,
  avgMinKneeAngle: 92.4,
  model: 'lite',
  avgFps: 28.5,
};

describe('squat session routes', () => {
  it('require a login', async () => {
    app = await startTestApp();
    expect((await app.call('GET', '/api/squat-sessions')).status).toBe(401);
    expect((await app.call('POST', '/api/squat-sessions', result)).status).toBe(401);
  });

  it('refuse results from users who did not opt in to the camera', async () => {
    const { app, token } = await signedIn(false);
    const res = await app.call('POST', '/api/squat-sessions', result, token);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'CAMERA_CONSENT_REQUIRED' });
    expect(app.calls).toEqual([]);
  });

  it('validate and save a result for the signed-in user', async () => {
    const { app, token } = await signedIn(true);
    const bad = await app.call('POST', '/api/squat-sessions', { ...result, repCount: -1 }, token);
    expect(bad.status).toBe(400);
    expect((await app.call('POST', '/api/squat-sessions', result, token)).status).toBe(201);
    expect((await app.call('GET', '/api/squat-sessions?days=30', undefined, token)).status).toBe(
      200,
    );
    expect(app.calls.map((c) => c.fn)).toEqual(['squats.create', 'squats.list']);
    expect(app.calls[0]!.args).toEqual([1, result]);
  });
});
