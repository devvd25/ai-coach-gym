import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';
import { connect, TEST_DB_NAME, TEST_EMAIL_DOMAIN } from './db.js';

declare module 'vitest' {
  export interface ProvidedContext {
    dbAvailable: boolean;
  }
}

const apiDir = fileURLToPath(new URL('../../', import.meta.url));

function sequelizeCli(...args: string[]) {
  // The CLI reads DB_NAME from the environment first, so this targets the test database.
  execFileSync(
    process.execPath,
    [
      fileURLToPath(new URL('../../node_modules/sequelize-cli/lib/sequelize', import.meta.url)),
      ...args,
      '--config',
      'src/db/config.cjs',
    ],
    { cwd: apiDir, env: { ...process.env, DB_NAME: TEST_DB_NAME }, stdio: 'pipe' },
  );
}

async function cleanUp() {
  const db = connect(TEST_DB_NAME);
  try {
    // Every row of a test user cascades from users.
    await db.query(`DELETE FROM users WHERE email LIKE '%${TEST_EMAIL_DOMAIN}'`);
  } finally {
    await db.close();
  }
}

/**
 * Creates and migrates the test database once per run. Without a reachable SQL Server the
 * *.db.test.ts files are skipped, unless REQUIRE_DB_TESTS=1 (set in CI) turns that into a failure.
 */
export async function setup(project: TestProject) {
  const master = connect('master');
  try {
    await master.authenticate();
  } catch {
    await master.close();
    if (process.env.REQUIRE_DB_TESTS === '1')
      throw new Error('SQL Server is required for DB tests');
    console.warn(
      '[db tests] SQL Server không chạy (pnpm db:up) → bỏ qua test tích hợp *.db.test.ts',
    );
    project.provide('dbAvailable', false);
    return;
  }
  await master.query(`IF DB_ID('${TEST_DB_NAME}') IS NULL CREATE DATABASE [${TEST_DB_NAME}]`);
  await master.close();
  sequelizeCli('db:migrate', '--migrations-path', 'src/db/migrations');
  sequelizeCli('db:seed:all', '--seeders-path', 'src/db/seeders');
  await cleanUp();
  project.provide('dbAvailable', true);
  return cleanUp;
}
