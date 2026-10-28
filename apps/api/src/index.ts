import { Ollama } from 'ollama';
import { createApp } from './app.js';
import { env } from './config/env.js';
import { createSequelize } from './db/sequelize.js';
import { createHealthService } from './modules/health/health.service.js';

const sequelize = createSequelize(env);
const ollama = new Ollama({ host: env.OLLAMA_HOST });

const health = createHealthService({
  pingDatabase: () => sequelize.authenticate(),
  listOllamaModels: async () => (await ollama.list()).models.map((m) => m.name),
  ollamaModel: env.OLLAMA_MODEL,
  version: process.env.npm_package_version ?? '0.1.0',
});

const app = createApp({ webOrigin: env.WEB_ORIGIN, health });

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
