import { addDays, mondayOf, parseIsoDate, type Dashboard } from '@ai-coach/shared';
import type { PlanService } from '../plans/plan.service.js';
import type { SquatService } from '../squat/squat.service.js';
import type { WeightService } from '../workouts/weight.service.js';
import type { WorkoutService } from '../workouts/workout.service.js';
import { buildDashboard } from './stats.aggregate.js';

export interface StatsService {
  dashboard(userId: number, weeks: number, today?: Date): Promise<Dashboard>;
}

export function createStatsService(deps: {
  plans: Pick<PlanService, 'weekSummaries'>;
  workouts: Pick<WorkoutService, 'list'>;
  weights: Pick<WeightService, 'list'>;
  squats: Pick<SquatService, 'list'>;
}): StatsService {
  return {
    async dashboard(userId, weeks, today = new Date()) {
      const currentWeek = mondayOf(today);
      const firstWeek = addDays(currentWeek, -7 * (weeks - 1));
      const from = parseIsoDate(firstWeek);
      const [workouts, plans, weights, squats] = await Promise.all([
        deps.workouts.list(userId, { from, limit: 1000 }),
        deps.plans.weekSummaries(userId, firstWeek),
        deps.weights.list(userId, firstWeek),
        deps.squats.list(userId, { from, limit: 1000 }),
      ]);
      return buildDashboard({ currentWeek, weeks, workouts, plans, weights, squats });
    },
  };
}
