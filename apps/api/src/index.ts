import { Ollama } from 'ollama';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initModels } from './db/models.js';
import { createSequelize } from './db/sequelize.js';
import { createAiService } from './modules/ai/ai.service.js';
import { createOllamaClient } from './modules/ai/llm.service.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordHasher } from './modules/auth/password.js';
import { createTokenService } from './modules/auth/token.service.js';
import { createExerciseService } from './modules/exercises/exercise.service.js';
import { createHealthService } from './modules/health/health.service.js';
import { createPlanService } from './modules/plans/plan.service.js';
import { createWeightService } from './modules/workouts/weight.service.js';
import { createWorkoutService } from './modules/workouts/workout.service.js';
import { createSequelizeProfileRepository } from './modules/profile/profile.repository.js';
import { createSquatService } from './modules/squat/squat.service.js';
import { createProfileService } from './modules/profile/profile.service.js';
import { createSequelizeUserRepository } from './modules/users/user.repository.js';

const sequelize = createSequelize(env);
initModels(sequelize);
const ollama = new Ollama({ host: env.OLLAMA_HOST });
const users = createSequelizeUserRepository();
const tokens = createTokenService(env.JWT_SECRET, env.JWT_TTL_MINUTES);
const exercises = createExerciseService();
const plans = createPlanService(sequelize, exercises);
const profiles = createProfileService(createSequelizeProfileRepository());
const workouts = createWorkoutService(sequelize, exercises, plans);
const weights = createWeightService();
const ai = createAiService({
  llm: createOllamaClient({
    host: env.OLLAMA_HOST,
    model: env.OLLAMA_MODEL,
    think: env.OLLAMA_THINK,
    timeoutMs: env.OLLAMA_TIMEOUT_MS,
  }),
  profiles,
  exercises,
  plans,
  workouts,
  weights,
  think: env.OLLAMA_THINK,
  timeoutMs: env.OLLAMA_TIMEOUT_MS,
  requestsPerHour: env.AI_RATE_LIMIT_PER_HOUR,
});

const app = createApp({
  webOrigin: env.WEB_ORIGIN,
  tokens,
  health: createHealthService({
    pingDatabase: () => sequelize.authenticate(),
    listOllamaModels: async () => (await ollama.list()).models.map((m) => m.name),
    ollamaModel: env.OLLAMA_MODEL,
    version: process.env.npm_package_version ?? '0.1.0',
  }),
  auth: createAuthService({
    users,
    hasher: createPasswordHasher(),
    tokens,
  }),
  profiles,
  exercises,
  plans,
  workouts,
  weights,
  ai,
  squats: createSquatService(),
  users,
  aiRequestsPerHour: env.AI_RATE_LIMIT_PER_HOUR,
});

const server = app.listen(env.API_PORT, () => {
  console.log(`API đang chạy tại http://localhost:${env.API_PORT} (kiểm tra: /health)`);
});

function shutdown() {
  server.close(() => {
    void sequelize.close().finally(() => process.exit(0));
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
