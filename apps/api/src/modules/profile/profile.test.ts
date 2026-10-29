import { profileSchema, userSchema, type Profile } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';

type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

const profile: Profile = {
  goal: 'muscle_gain',
  sex: 'male',
  age: 21,
  heightCm: 170,
  weightKg: 68.4,
  level: 'intermediate',
  injuries: 'Đau gối trái khi xuống sâu',
  sessionsPerWeek: 4,
  sessionMinutes: 60,
  preferredDays: ['mon', 'wed', 'thu', 'sun'],
  location: 'gym',
  equipment: ['barbell', 'dumbbell', 'machine'],
};

async function signUp(email: string) {
  return app!.signUp(email);
}

describe('/api/profile', () => {
  it('is 404 before onboarding, then saves and returns the profile', async () => {
    app = await startTestApp();
    const token = await signUp('a@email.com');
    expect((await app.call('GET', '/api/profile', undefined, token)).status).toBe(404);

    const saved = await app.call('PUT', '/api/profile', profile, token);
    expect(saved.status).toBe(200);
    expect(profileSchema.parse(saved.body)).toEqual(profile);

    const me = userSchema.parse((await app.call('GET', '/api/auth/me', undefined, token)).body);
    expect(me.hasProfile).toBe(true);
  });

  it('validates the body with field messages', async () => {
    app = await startTestApp();
    const token = await signUp('a@email.com');
    const res = await app.call('PUT', '/api/profile', { ...profile, age: 9, equipment: [] }, token);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { fields: { age: expect.any(String), equipment: expect.any(String) } },
    });
  });

  it("keeps each user's profile separate", async () => {
    app = await startTestApp();
    const a = await signUp('a@email.com');
    const b = await signUp('b@email.com');
    await app.call('PUT', '/api/profile', profile, a);
    expect((await app.call('GET', '/api/profile', undefined, b)).status).toBe(404);
  });

  it('requires authentication', async () => {
    app = await startTestApp();
    expect((await app.call('PUT', '/api/profile', profile)).status).toBe(401);
  });
});
