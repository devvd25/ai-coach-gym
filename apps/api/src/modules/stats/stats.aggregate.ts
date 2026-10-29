import {
  addDays,
  mondayOf,
  type Dashboard,
  type SquatSession,
  type WeekStat,
  type WeightEntry,
  type WorkoutSummary,
} from '@ai-coach/shared';

export interface PlanWeek {
  weekStart: string;
  planned: number;
  completed: number;
}

export interface DashboardInput {
  /** Monday of the newest week shown. */
  currentWeek: string;
  weeks: number;
  workouts: readonly WorkoutSummary[];
  plans: readonly PlanWeek[];
  weights: readonly WeightEntry[];
  squats: readonly SquatSession[];
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Groups raw rows into Monday-based weeks; weeks without data are kept as zeros. */
export function buildDashboard(input: DashboardInput): Dashboard {
  const starts = Array.from({ length: input.weeks }, (_, i) =>
    addDays(input.currentWeek, -7 * (input.weeks - 1 - i)),
  );
  const first = starts[0]!;
  const byWeek = new Map<string, WeekStat>(
    starts.map((weekStart) => [
      weekStart,
      {
        weekStart,
        workouts: 0,
        sets: 0,
        volumeKg: 0,
        plannedSessions: 0,
        completedSessions: 0,
        completionPct: null,
        squatSessions: 0,
        squatReps: 0,
      },
    ]),
  );

  for (const w of input.workouts) {
    const week = byWeek.get(mondayOf(new Date(w.startedAt)));
    if (!week) continue;
    week.workouts += 1;
    week.sets += w.setCount;
    week.volumeKg = round1(week.volumeKg + w.volumeKg);
  }
  for (const p of input.plans) {
    const week = byWeek.get(p.weekStart);
    if (!week || p.planned === 0) continue;
    week.plannedSessions = p.planned;
    week.completedSessions = p.completed;
    week.completionPct = Math.round((p.completed / p.planned) * 100);
  }
  const squats = input.squats.filter((s) => mondayOf(new Date(s.startedAt)) >= first);
  for (const s of squats) {
    const week = byWeek.get(mondayOf(new Date(s.startedAt)));
    if (!week) continue;
    week.squatSessions += 1;
    week.squatReps += s.repCount;
  }

  return {
    weeks: starts.map((s) => byWeek.get(s)!),
    weights: input.weights
      .filter((w) => w.date >= first)
      .map((w) => ({ date: w.date, weightKg: w.weightKg }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    squats: squats
      .map((s) => ({
        startedAt: s.startedAt,
        repCount: s.repCount,
        avgMinKneeAngle: s.avgMinKneeAngle,
      }))
      .sort((a, b) => a.startedAt.localeCompare(b.startedAt)),
  };
}
