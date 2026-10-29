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
import type { ExerciseService } from '../modules/exercises/exercise.service.js';
import type { PlanService } from '../modules/plans/plan.service.js';
import type { WeightService } from '../modules/workouts/weight.service.js';
import type { WorkoutService } from '../modules/workouts/workout.service.js';
import type { AiService } from '../modules/ai/ai.service.js';
import type { SquatService } from '../modules/squat/squat.service.js';

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

/**
 * Training services that record what the routes pass them. Their real implementations are thin
 * Sequelize code; these tests cover routing, auth and validation, the shared package covers the maths.
 */
export function stubTrainingServices() {
  const calls: { fn: string; args: unknown[] }[] = [];
  const record =
    <T>(fn: string, result: T) =>
    async (...args: unknown[]) => {
      calls.push({ fn, args });
      return result;
    };
  const exercises: ExerciseService = {
    list: record('exercises.list', []),
    get: record('exercises.get', undefined as never),
    assertExist: record('exercises.assertExist', undefined),
  };
  const plans: PlanService = {
    getWeek: record('plans.getWeek', {
      id: 1,
      weekStart: '2026-10-26',
      source: 'manual',
      aiNote: null,
      sessions: [],
    }),
    createWeek: record('plans.createWeek', {
      id: 1,
      weekStart: '2026-10-26',
      source: 'manual',
      aiNote: null,
      sessions: [],
    }),
    getSession: record('plans.getSession', undefined as never),
    addSession: record('plans.addSession', { ok: true } as never),
    updateSession: record('plans.updateSession', { ok: true } as never),
    deleteSession: record('plans.deleteSession', undefined),
    setCompleted: record('plans.setCompleted', { ok: true } as never),
    completeOwned: record('plans.completeOwned', undefined),
    replaceWeek: record('plans.replaceWeek', undefined as never),
  };
  const workouts: WorkoutService = {
    create: record('workouts.create', { ok: true } as never),
    list: record('workouts.list', []),
    get: record('workouts.get', undefined as never),
  };
  const weights: WeightService = {
    list: record('weights.list', []),
    upsert: record('weights.upsert', { date: '2026-10-28', weightKg: 68.4, note: '' }),
    remove: record('weights.remove', undefined),
  };
  const meta = {
    requestId: 1,
    model: 'qwen3:4b',
    promptVersion: 'chat.v1',
    latencyMs: 10,
    schemaValid: true,
    retryCount: 0,
    violations: [],
    usedFallback: false,
  };
  const ai: AiService = {
    generatePlan: record('ai.generatePlan', { ok: true } as never),
    generateNutrition: record('ai.generateNutrition', { ok: true } as never),
    getNutrition: record('ai.getNutrition', { ok: true } as never),
    review: record('ai.review', { ok: true } as never),
    chat: record('ai.chat', { answer: 'Chào bạn', suggestions: [], meta }),
    listRequests: record('ai.listRequests', []),
    status: () => ({
      model: 'qwen3:4b',
      think: false,
      timeoutMs: 120_000,
      promptVersions: {},
      requestsPerHour: 20,
    }),
  };
  const squats: SquatService = {
    create: record('squats.create', { ok: true } as never),
    list: record('squats.list', []),
  };
  return { exercises, plans, workouts, weights, ai, squats, calls };
}

/** Starts the real Express app on a random port with in-memory repositories. */
export async function startTestApp(
  opts: { authAttemptsPer15Min?: number; aiRequestsPerHour?: number } = {},
) {
  const repos = memoryRepos();
  const tokens = createTokenService(TEST_SECRET, 60);
  const training = stubTrainingServices();
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
    users: repos.userRepo,
    ...training,
    authAttemptsPer15Min: opts.authAttemptsPer15Min ?? 100,
    aiRequestsPerHour: opts.aiRequestsPerHour ?? 100,
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

  return { base, call, repos, tokens, calls: training.calls, close: () => server.close() };
}
