import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Profile } from '@ai-coach/shared';
import { Sequelize } from 'sequelize';
import { initModels } from '../db/models.js';
import { createSequelizeProfileRepository } from '../modules/profile/profile.repository.js';
import { createSequelizeUserRepository } from '../modules/users/user.repository.js';

/**
 * Integration tests run against a separate database on the same SQL Server (never the dev data).
 * Settings come from the environment or the root .env, like the app.
 */
export const TEST_DB_NAME = process.env.TEST_DB_NAME ?? 'ai_coach_test';
export const TEST_EMAIL_DOMAIN = '@db-test.local';

const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

export function dbSettings() {
  return {
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 1433),
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
  };
}

export function connect(database: string): Sequelize {
  // Sequelize captures a stack trace on every query; Vite's source-map hook crashes formatting it
  // (code.charCodeAt is not a function), so DB code keeps Node's plain stack traces.
  Reflect.deleteProperty(Error, 'prepareStackTrace');
  const s = dbSettings();
  return new Sequelize(database, s.user, s.password, {
    host: s.host,
    port: s.port,
    dialect: 'mssql',
    dialectOptions: {
      options: { encrypt: true, trustServerCertificate: true, connectTimeout: 5000 },
    },
    define: { underscored: true },
    logging: false,
  });
}

/** Connection to the test database with all models registered. */
export function connectTestDb(): Sequelize {
  const sequelize = connect(TEST_DB_NAME);
  initModels(sequelize);
  return sequelize;
}

let counter = 0;

/** A consented user with a profile; emails are unique so test files can run in parallel. */
export async function createTestUser(profile: Profile) {
  const users = createSequelizeUserRepository();
  const email = `u${Date.now()}${process.pid}${counter++}${TEST_EMAIL_DOMAIN}`;
  const user = await users.create({ email, passwordHash: 'not-a-real-hash', fullName: 'Kiểm thử' });
  await users.setConsent(user.id, { camera: true, research: false }, new Date());
  await createSequelizeProfileRepository().upsert(user.id, profile);
  return user.id;
}
