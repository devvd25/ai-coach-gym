import { Ollama } from 'ollama';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { initModels } from './db/models.js';
import { createSequelize } from './db/sequelize.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { createPasswordHasher } from './modules/auth/password.js';
import { createTokenService } from './modules/auth/token.service.js';
import { createHealthService } from './modules/health/health.service.js';
import { createSequelizeProfileRepository } from './modules/profile/profile.repository.js';
import { createProfileService } from './modules/profile/profile.service.js';
import { createSequelizeUserRepository } from './modules/users/user.repository.js';

const sequelize = createSequelize(env);
initModels(sequelize);
const ollama = new Ollama({ host: env.OLLAMA_HOST });
const tokens = createTokenService(env.JWT_SECRET, env.JWT_TTL_MINUTES);

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
    users: createSequelizeUserRepository(),
    hasher: createPasswordHasher(),
    tokens,
  }),
  profiles: createProfileService(createSequelizeProfileRepository()),
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
