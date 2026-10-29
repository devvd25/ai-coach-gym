import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Creates/migrates the ai_coach_test database for *.db.test.ts (skipped without SQL Server).
    globalSetup: ['src/test/db-global-setup.ts'],
    hookTimeout: 120_000,
  },
});
