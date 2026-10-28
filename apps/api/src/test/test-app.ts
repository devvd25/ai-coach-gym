import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import type { Profile } from '@ai-coach/shared';
import { createApp } from '../app.js';
import { createAuthService } from '../modules/auth/auth.service.js';
import { createPasswordHasher } from '../modules/auth/password.js';
import { createTokenService } from '../modules/auth/token.service.js';
import { createHealthService } from '../modules/health/health.service.js';
import type { ProfileRepository } from '../modules/profile/profile.repository.js';
import { createProfileService } from '../modules/profile/profile.service.js';
import type { UserRecord, UserRepository } from '../modules/users/user.repository.js';

export function memoryRepos() {
  const users = new Map<number, Omit<UserRecord, 'hasProfile'>>();
  const profiles = new Map<number, Profile>();
  const withProfile = (u: Omit<UserRecord, 'hasProfile'>): UserRecord => ({
    ...u,
    hasProfile: profiles.has(u.id),
  });

  const userRepo: UserRepository = {
    async findByEmail(email) {
      const u = [...users.values()].find((x) => x.email === email);
      return u ? withProfile(u) : null;
    },
    async findById(id) {
      const u = users.get(id);
      return u ? withProfile(u) : null;
    },
    async create(input) {
      const u = {
        id: users.size + 1,
        ...input,
        healthConsentAt: null,
        consentCamera: false,
        consentResearch: false,
      };
      users.set(u.id, u);
      return withProfile(u);
    },
    async setConsent(id, consent, at) {
      const u = users.get(id);
      if (u)
        users.set(id, {
          ...u,
          healthConsentAt: at,
          consentCamera: consent.camera,
          consentResearch: consent.research,
        });
    },
  };
  const profileRepo: ProfileRepository = {
    async get(userId) {
      return profiles.get(userId) ?? null;
    },
    async upsert(userId, profile) {
      profiles.set(userId, profile);
      return profile;
    },
  };
  return { userRepo, profileRepo, users };
}

export const TEST_SECRET = 'test-secret-that-is-at-least-32-characters-long';

/** Starts the real Express app on a random port with in-memory repositories. */
export async function startTestApp(opts: { authAttemptsPer15Min?: number } = {}) {
  const repos = memoryRepos();
  const tokens = createTokenService(TEST_SECRET, 60);
  const app = createApp({
    webOrigin: 'http://localhost:5173',
    tokens,
    health: createHealthService({
      pingDatabase: async () => undefined,
      listOllamaModels: async () => ['qwen3:4b'],
      ollamaModel: 'qwen3:4b',
      version: 'test',
    }),
    auth: createAuthService({ users: repos.userRepo, hasher: createPasswordHasher(4), tokens }),
    profiles: createProfileService(repos.profileRepo),
    authAttemptsPer15Min: opts.authAttemptsPer15Min ?? 100,
  });
  const server: Server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const base = `http://127.0.0.1:${port}`;

  async function call(method: string, path: string, body?: unknown, token?: string) {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
  }

  return { base, call, repos, tokens, close: () => server.close() };
}
