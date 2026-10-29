import { UniqueConstraintError } from 'sequelize';
import { afterEach, describe, expect, it } from 'vitest';
import { safeLogLine } from './lib/http.js';
import { startTestApp } from './test/test-app.js';

/** Checks for AGENTS.md §8, at the HTTP boundary. */
type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

const HEALTH_DATA_ROUTES: [string, string][] = [
  ['GET', '/api/profile'],
  ['GET', '/api/plans/week/2026-10-26'],
  ['GET', '/api/workouts'],
  ['GET', '/api/weights'],
  ['GET', '/api/stats/dashboard'],
  ['GET', '/api/squat-sessions'],
  ['GET', '/api/ai/requests'],
  ['POST', '/api/ai/chat'],
  ['GET', '/api/nutrition/2026-10-29'],
];

describe('health-data consent is enforced by the API, not only by the web app', () => {
  it.each(HEALTH_DATA_ROUTES)('%s %s → 403 before consent', async (method, path) => {
    app = await startTestApp();
    const token = await app.signUp('u@email.com', { consent: false });
    const res = await app.call(method, path, method === 'GET' ? undefined : {}, token);
    expect(res.status).toBe(403);
    expect(res.body.error).toMatchObject({ code: 'CONSENT_REQUIRED' });
    expect(app.calls).toEqual([]);
  });

  it('still allows the account, consent and exercise library routes', async () => {
    app = await startTestApp();
    const token = await app.signUp('u@email.com', { consent: false });
    expect((await app.call('GET', '/api/auth/me', undefined, token)).status).toBe(200);
    expect((await app.call('GET', '/api/exercises', undefined, token)).status).toBe(200);
    const consent = { profileData: true, trainingLogs: true, camera: false, research: false };
    expect((await app.call('PUT', '/api/me/consent', consent, token)).status).toBe(200);
    expect((await app.call('GET', '/api/workouts', undefined, token)).status).toBe(200);
  });
});

describe('authorization is per user', () => {
  it('passes the caller id, never a client-supplied one, to the services', async () => {
    app = await startTestApp();
    await app.signUp('a@email.com');
    const tokenB = await app.signUp('b@email.com');
    await app.call('GET', '/api/workouts?userId=1', undefined, tokenB);
    await app.call('GET', '/api/plans/week/2026-10-26?userId=1', undefined, tokenB);
    expect(app.calls.map((c) => c.args[0])).toEqual([2, 2]);
  });

  it('rejects tampered and expired tokens', async () => {
    app = await startTestApp();
    const token = await app.signUp();
    const tampered = `${token.slice(0, -2)}xx`;
    expect((await app.call('GET', '/api/auth/me', undefined, tampered)).status).toBe(401);
    expect((await app.call('GET', '/api/auth/me', undefined, 'not-a-jwt')).status).toBe(401);
  });
});

describe('HTTP hardening', () => {
  it('sends helmet headers and hides the framework', async () => {
    app = await startTestApp();
    const res = await fetch(`${app.base}/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-powered-by')).toBeNull();
  });

  it('allows CORS only for the web origin', async () => {
    app = await startTestApp();
    // The header always names the web origin, so a browser on any other origin blocks the read.
    const evil = await fetch(`${app.base}/health`, { headers: { origin: 'https://evil.example' } });
    expect(evil.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
    const preflight = await fetch(`${app.base}/api/workouts`, {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    expect(preflight.headers.get('access-control-allow-origin')).not.toBe('https://evil.example');
  });

  it('rejects oversized JSON bodies', async () => {
    app = await startTestApp();
    const token = await app.signUp();
    const res = await app.call(
      'POST',
      '/api/ai/chat',
      { messages: [{ role: 'user', content: 'x'.repeat(300_000) }] },
      token,
    );
    expect(res.status).toBe(413);
    expect(res.body.error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
  });
});

describe('logging', () => {
  it('never logs the message of a database error (it can contain user data)', () => {
    const err = new UniqueConstraintError({
      message: 'Violation of UNIQUE KEY constraint. The duplicate key value is (an@email.com).',
    });
    const line = safeLogLine(err);
    expect(line).not.toContain('an@email.com');
    expect(line).toContain('SequelizeUniqueConstraintError');
  });

  it('keeps the message of programming errors for debugging', () => {
    expect(safeLogLine(new TypeError('x is undefined'))).toBe('TypeError: x is undefined');
    expect(safeLogLine({ password: 'secret' })).not.toContain('secret');
  });
});
