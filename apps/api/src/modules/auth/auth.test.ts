import { authResponseSchema, userSchema } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';
import { createTokenService } from './token.service.js';

type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

const minh = {
  fullName: 'Nguyễn Minh',
  email: 'Minh@Email.com',
  password: 'Squat2026',
  acceptTerms: true,
};

async function registered() {
  app = await startTestApp();
  const res = await app.call('POST', '/api/auth/register', minh);
  return { app, token: authResponseSchema.parse(res.body).token };
}

describe('POST /api/auth/register', () => {
  it('creates the account, stores only a hash and returns a token', async () => {
    app = await startTestApp();
    const res = await app.call('POST', '/api/auth/register', minh);
    expect(res.status).toBe(201);
    const body = authResponseSchema.parse(res.body);
    expect(body.user).toMatchObject({
      email: 'minh@email.com',
      hasProfile: false,
      healthConsentAt: null,
    });
    const stored = [...app.repos.users.values()][0];
    expect(stored?.passwordHash).not.toContain('Squat2026');
    expect(stored?.passwordHash.startsWith('$2')).toBe(true);
  });

  it('rejects a duplicate email regardless of case', async () => {
    const { app } = await registered();
    const res = await app.call('POST', '/api/auth/register', { ...minh, email: 'MINH@email.com' });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ error: { code: 'EMAIL_TAKEN' } });
  });

  it('returns per-field validation messages', async () => {
    app = await startTestApp();
    const res = await app.call('POST', '/api/auth/register', { ...minh, password: 'weak' });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      error: { code: 'VALIDATION', fields: { password: expect.any(String) } },
    });
  });
});

describe('POST /api/auth/login', () => {
  it('logs in with the right password', async () => {
    const { app } = await registered();
    const res = await app.call('POST', '/api/auth/login', {
      email: 'minh@email.com',
      password: 'Squat2026',
    });
    expect(res.status).toBe(200);
    expect(authResponseSchema.parse(res.body).user.fullName).toBe('Nguyễn Minh');
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { app } = await registered();
    const wrong = await app.call('POST', '/api/auth/login', {
      email: 'minh@email.com',
      password: 'Nope1234',
    });
    const unknown = await app.call('POST', '/api/auth/login', {
      email: 'ai@email.com',
      password: 'Nope1234',
    });
    expect(wrong.status).toBe(401);
    expect(unknown).toEqual(wrong);
  });

  it('rate-limits repeated attempts', async () => {
    app = await startTestApp({ authAttemptsPer15Min: 3 });
    const attempt = () =>
      app!.call('POST', '/api/auth/login', { email: 'x@y.vn', password: 'Nope1234' });
    for (let i = 0; i < 3; i++) expect((await attempt()).status).toBe(401);
    const blocked = await attempt();
    expect(blocked.status).toBe(429);
    expect(blocked.body).toMatchObject({ error: { code: 'RATE_LIMITED' } });
  });
});

describe('protected routes', () => {
  it('GET /api/auth/me needs a valid token', async () => {
    const { app, token } = await registered();
    expect((await app.call('GET', '/api/auth/me')).status).toBe(401);
    expect((await app.call('GET', '/api/auth/me', undefined, 'not-a-jwt')).status).toBe(401);
    const me = await app.call('GET', '/api/auth/me', undefined, token);
    expect(userSchema.parse(me.body).email).toBe('minh@email.com');
  });

  it('rejects a token signed with another secret', async () => {
    const { app } = await registered();
    const forged = await createTokenService('another-secret-that-is-also-32-chars!!', 60).sign(1);
    expect((await app.call('GET', '/api/auth/me', undefined, forged.token)).status).toBe(401);
  });

  it('PUT /api/me/consent requires the mandatory items and stores the optional ones', async () => {
    const { app, token } = await registered();
    const missing = await app.call(
      'PUT',
      '/api/me/consent',
      { profileData: true, trainingLogs: false, camera: true, research: false },
      token,
    );
    expect(missing.status).toBe(400);
    const ok = await app.call(
      'PUT',
      '/api/me/consent',
      { profileData: true, trainingLogs: true, camera: true, research: false },
      token,
    );
    const user = userSchema.parse(ok.body);
    expect(user.healthConsentAt).not.toBeNull();
    expect(user.consents).toEqual({ camera: true, research: false });
  });

  it('answers malformed JSON with 400 instead of 500', async () => {
    app = await startTestApp();
    const res = await fetch(`${app.base}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"email":',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'BAD_JSON' } });
  });
});
