import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { healthResponseSchema } from '@ai-coach/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp, type AppDeps } from '../../app.js';
import { createAuthService } from '../auth/auth.service.js';
import { createPasswordHasher } from '../auth/password.js';
import { createTokenService } from '../auth/token.service.js';
import { createProfileService } from '../profile/profile.service.js';
import { memoryRepos, stubTrainingServices, TEST_SECRET } from '../../test/test-app.js';
import { createHealthService, type HealthServiceDeps } from './health.service.js';

function appWith(health: AppDeps['health']) {
  const repos = memoryRepos();
  const tokens = createTokenService(TEST_SECRET, 60);
  return createApp({
    webOrigin: 'http://localhost:5173',
    health,
    tokens,
    auth: createAuthService({ users: repos.userRepo, hasher: createPasswordHasher(4), tokens }),
    profiles: createProfileService(repos.profileRepo),
    users: repos.userRepo,
    ...stubTrainingServices(),
  });
}

const base: HealthServiceDeps = {
  pingDatabase: async () => undefined,
  listOllamaModels: async () => ['qwen3:4b', 'qwen3.5:9b'],
  ollamaModel: 'qwen3:4b',
  version: 'test',
  timeoutMs: 50,
};

let server: Server | undefined;
afterEach(() => server?.close());

async function getHealth(deps: HealthServiceDeps) {
  server = appWith(createHealthService(deps)).listen(0);
  const { port } = server.address() as AddressInfo;
  const res = await fetch(`http://127.0.0.1:${port}/health`);
  return { status: res.status, body: healthResponseSchema.parse(await res.json()) };
}

describe('GET /health', () => {
  it('returns 200 when database and model are available', async () => {
    const { status, body } = await getHealth(base);
    expect(status).toBe(200);
    expect(body.status).toBe('ok');
    expect(body.checks.ollama.modelAvailable).toBe(true);
  });

  it('returns 503 with a generic message when the database fails', async () => {
    const { status, body } = await getHealth({
      ...base,
      pingDatabase: async () => {
        throw new Error('Login failed for user sa');
      },
    });
    expect(status).toBe(503);
    expect(body.checks.database.ok).toBe(false);
    expect(body.checks.database.error).not.toContain('sa');
  });

  it('reports a missing model with the pull command', async () => {
    const { body } = await getHealth({ ...base, listOllamaModels: async () => ['llama3:8b'] });
    expect(body.status).toBe('degraded');
    expect(body.checks.ollama.ok).toBe(true);
    expect(body.checks.ollama.error).toContain('ollama pull qwen3:4b');
  });

  it('times out a hanging Ollama call', async () => {
    const { body } = await getHealth({ ...base, listOllamaModels: () => new Promise(() => {}) });
    expect(body.checks.ollama.ok).toBe(false);
    expect(body.checks.ollama.latencyMs).toBeNull();
  });
});

describe('unknown routes', () => {
  it('return a JSON 404', async () => {
    server = appWith(createHealthService(base)).listen(0);
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' },
    });
  });
});
