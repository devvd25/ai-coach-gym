/**
 * Exports weekly training data of users who opted in to research use (consent screen) to
 * ml/data/real_weeks.csv, pseudonymised. Run with the database up:
 *
 *   pnpm ml:export            (or: pnpm --filter @ai-coach/api export:training)
 *
 * EXPORT_SALT keeps pseudonyms stable across exports; without it a random salt is used, so two
 * exports cannot be linked to each other.
 */
import { randomBytes } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { env } from '../config/env.js';
import { initModels } from '../db/models.js';
import { createSequelize } from '../db/sequelize.js';
import { createExerciseService } from '../modules/exercises/exercise.service.js';
import { createPlanService } from '../modules/plans/plan.service.js';
import { createSequelizeProfileRepository } from '../modules/profile/profile.repository.js';
import { createSquatService } from '../modules/squat/squat.service.js';
import { toCsv, userWeekRows, type ExportRow } from '../modules/stats/export.js';
import { UserModel } from '../modules/users/user.model.js';
import { createWeightService } from '../modules/workouts/weight.service.js';
import { createWorkoutService } from '../modules/workouts/workout.service.js';

const sequelize = createSequelize(env);
initModels(sequelize);
const exercises = createExerciseService();
const plans = createPlanService(sequelize, exercises);
const workouts = createWorkoutService(sequelize, exercises, plans);
const weights = createWeightService();
const squats = createSquatService();
const profiles = createSequelizeProfileRepository();

const salt = process.env.EXPORT_SALT ?? randomBytes(16).toString('hex');
const since = new Date('2000-01-01T00:00:00');
const outDir = fileURLToPath(new URL('../../../../ml/data/', import.meta.url));

try {
  const users = await UserModel.findAll({ where: { consentResearch: true }, attributes: ['id'] });
  const rows: ExportRow[] = [];
  let skipped = 0;
  for (const { id } of users) {
    const profile = await profiles.get(id);
    if (!profile) {
      skipped++;
      continue;
    }
    const [w, p, kg, sq] = await Promise.all([
      workouts.list(id, { from: since, limit: 100_000 }),
      plans.weekSummaries(id, '2000-01-03'),
      weights.list(id, '2000-01-01'),
      squats.list(id, { from: since, limit: 100_000 }),
    ]);
    rows.push(
      ...userWeekRows(
        { userId: id, profile, workouts: w, plans: p, weights: kg, squats: sq },
        salt,
        new Date(),
      ),
    );
  }
  mkdirSync(outDir, { recursive: true });
  const file = `${outDir}real_weeks.csv`;
  writeFileSync(file, toCsv(rows), 'utf8');
  console.log(
    `Đã xuất ${rows.length} dòng (user-tuần) của ${users.length - skipped} người dùng đồng ý nghiên cứu → ${file}`,
  );
} finally {
  await sequelize.close();
}
