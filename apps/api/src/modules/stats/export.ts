import { createHmac } from 'node:crypto';
import {
  addDays,
  mondayOf,
  type Profile,
  type SquatSession,
  type WeightEntry,
  type WorkoutSummary,
} from '@ai-coach/shared';
import { buildDashboard, type PlanWeek } from './stats.aggregate.js';

/**
 * One row per user-week, the format shared with ml/generate_synthetic.py so the notebook reads
 * real and synthetic data the same way. No names, emails, ids or exact ages leave the database.
 */
export const EXPORT_COLUMNS = [
  'user_id',
  'week_start',
  'week_index',
  'sex',
  'age_group',
  'goal',
  'level',
  'sessions_target',
  'planned_sessions',
  'completed_sessions',
  'completion_rate',
  'workouts',
  'total_sets',
  'volume_kg',
  'avg_rpe',
  'weight_kg',
  'squat_reps',
  'is_synthetic',
] as const;

export type ExportRow = Record<(typeof EXPORT_COLUMNS)[number], string | number>;

/** Stable within one export (same salt), not reversible without the salt. */
export function pseudonym(userId: number, salt: string): string {
  return `u_${createHmac('sha256', salt).update(String(userId)).digest('hex').slice(0, 10)}`;
}

/** 23 → 20, 37 → 35: five-year groups instead of the exact age. */
export const ageGroup = (age: number) => Math.floor(age / 5) * 5;

export interface UserHistory {
  userId: number;
  profile: Profile;
  workouts: readonly WorkoutSummary[];
  plans: readonly PlanWeek[];
  weights: readonly WeightEntry[];
  squats: readonly SquatSession[];
}

/**
 * Complete weeks from the user's first activity up to the week before `today` (the current week
 * is still running, so it would look like a drop in adherence).
 */
export function userWeekRows(h: UserHistory, salt: string, today: Date): ExportRow[] {
  const lastWeek = addDays(mondayOf(today), -7);
  const starts = [
    ...h.workouts.map((w) => mondayOf(new Date(w.startedAt))),
    ...h.plans.filter((p) => p.planned > 0).map((p) => p.weekStart),
  ].sort();
  const firstWeek = starts[0];
  if (!firstWeek || firstWeek > lastWeek) return [];
  const weeks =
    Math.round(
      (Date.parse(`${lastWeek}T00:00:00Z`) - Date.parse(`${firstWeek}T00:00:00Z`)) /
        (7 * 86_400_000),
    ) + 1;
  const d = buildDashboard({
    currentWeek: lastWeek,
    weeks,
    workouts: h.workouts,
    plans: h.plans,
    weights: h.weights,
    squats: h.squats,
  });
  const id = pseudonym(h.userId, salt);
  let lastWeight: number | null = null;

  return d.weeks.map((w, i) => {
    const end = addDays(w.weekStart, 6);
    const rpes = h.workouts
      .filter((x) => mondayOf(new Date(x.startedAt)) === w.weekStart && x.avgRpe !== null)
      .map((x) => x.avgRpe as number);
    const weighed = d.weights.filter((x) => x.date >= w.weekStart && x.date <= end).at(-1);
    // Carry the last known weight forward: people do not weigh themselves every week.
    if (weighed) lastWeight = weighed.weightKg;
    return {
      user_id: id,
      week_start: w.weekStart,
      week_index: i,
      sex: h.profile.sex,
      age_group: ageGroup(h.profile.age),
      goal: h.profile.goal,
      level: h.profile.level,
      sessions_target: h.profile.sessionsPerWeek,
      planned_sessions: w.plannedSessions,
      completed_sessions: w.completedSessions,
      completion_rate: w.plannedSessions ? round(w.completedSessions / w.plannedSessions, 3) : '',
      workouts: w.workouts,
      total_sets: w.sets,
      volume_kg: w.volumeKg,
      avg_rpe: rpes.length ? round(rpes.reduce((a, b) => a + b, 0) / rpes.length, 2) : '',
      weight_kg: lastWeight ?? '',
      squat_reps: w.squatReps,
      is_synthetic: 0,
    };
  });
}

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;

export function toCsv(rows: readonly ExportRow[]): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
  };
  return [
    EXPORT_COLUMNS.join(','),
    ...rows.map((r) => EXPORT_COLUMNS.map((c) => cell(r[c])).join(',')),
  ]
    .join('\n')
    .concat('\n');
}
