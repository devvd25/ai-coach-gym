import { afterEach, describe, expect, it } from 'vitest';
import { startTestApp } from '../../test/test-app.js';

type TestApp = Awaited<ReturnType<typeof startTestApp>>;
let app: TestApp | undefined;
afterEach(() => app?.close());

async function signedIn(opts: { aiRequestsPerHour?: number } = {}) {
  app = await startTestApp(opts);
  return { app, token: await app.signUp() };
}

const ask = { messages: [{ role: 'user', content: 'Tôi nên tập gì hôm nay?' }] };

describe('AI routes', () => {
  it.each([
    ['POST', '/api/ai/plan'],
    ['POST', '/api/ai/nutrition'],
    ['POST', '/api/ai/review'],
    ['POST', '/api/ai/chat'],
    ['GET', '/api/ai/requests'],
    ['GET', '/api/nutrition/2026-10-29'],
  ])('%s %s requires a login', async (method, path) => {
    app = await startTestApp();
    expect((await app.call(method, path, method === 'GET' ? undefined : {})).status).toBe(401);
    expect(app.calls).toEqual([]);
  });

  it('validates input before calling the model', async () => {
    const { app, token } = await signedIn();
    expect(
      (await app.call('POST', '/api/ai/plan', { weekStart: '2026-10-28' }, token)).status,
    ).toBe(400);
    expect((await app.call('POST', '/api/ai/nutrition', { date: 'hôm nay' }, token)).status).toBe(
      400,
    );
    const lastFromAi = { messages: [{ role: 'assistant', content: 'Chào bạn' }] };
    expect((await app.call('POST', '/api/ai/chat', lastFromAi, token)).status).toBe(400);
    expect(app.calls).toEqual([]);
  });

  it('passes the user id and the parsed body to the service', async () => {
    const { app, token } = await signedIn();
    expect(
      (await app.call('POST', '/api/ai/plan', { weekStart: '2026-10-26' }, token)).status,
    ).toBe(201);
    const chat = await app.call('POST', '/api/ai/chat', ask, token);
    expect(chat.status).toBe(200);
    expect(chat.body.answer).toBe('Chào bạn');
    expect(app.calls).toEqual([
      { fn: 'ai.generatePlan', args: [1, '2026-10-26'] },
      { fn: 'ai.chat', args: [1, ask.messages] },
    ]);
  });

  it('limits AI generations per user', async () => {
    const { app, token } = await signedIn({ aiRequestsPerHour: 2 });
    const statuses = [];
    for (let i = 0; i < 3; i++)
      statuses.push((await app.call('POST', '/api/ai/chat', ask, token)).status);
    expect(statuses).toEqual([200, 200, 429]);
    // Reading the history is not a generation and stays available.
    expect((await app.call('GET', '/api/ai/requests', undefined, token)).status).toBe(200);
  });
});
