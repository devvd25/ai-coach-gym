import type { WorkoutSummary } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import { PROFILE } from '../../test/library.js';
import { ageGroup, EXPORT_COLUMNS, pseudonym, toCsv, userWeekRows } from './export.js';

const workout = (date: string, volumeKg: number, avgRpe: number | null): WorkoutSummary => ({
  id: 1,
  sessionId: null,
  title: 'Buổi',
  startedAt: new Date(`${date}T18:00:00`).toISOString(),
  finishedAt: new Date(`${date}T19:00:00`).toISOString(),
  durationMin: 60,
  volumeKg,
  setCount: 12,
  avgRpe,
  feeling: null,
});

describe('training export', () => {
  const rows = userWeekRows(
    {
      userId: 42,
      profile: { ...PROFILE, age: 23 },
      workouts: [workout('2026-10-06', 1000, 7), workout('2026-10-08', 1200, 8)],
      plans: [
        { weekStart: '2026-10-05', planned: 4, completed: 2 },
        { weekStart: '2026-10-19', planned: 4, completed: 4 },
      ],
      weights: [{ date: '2026-10-07', weightKg: 68.2, note: '' }],
      squats: [],
    },
    'salt',
    new Date('2026-10-29T12:00:00'),
  );

  it('covers every full week from the first activity, excluding the running week', () => {
    expect(rows.map((r) => r.week_start)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19']);
    expect(rows.map((r) => r.week_index)).toEqual([0, 1, 2]);
  });

  it('computes weekly values and carries the last weight forward', () => {
    expect(rows[0]).toMatchObject({
      completion_rate: 0.5,
      workouts: 2,
      volume_kg: 2200,
      avg_rpe: 7.5,
      weight_kg: 68.2,
      is_synthetic: 0,
    });
    expect(rows[1]).toMatchObject({
      completion_rate: '',
      workouts: 0,
      avg_rpe: '',
      weight_kg: 68.2,
    });
    expect(rows[2]).toMatchObject({ completion_rate: 1 });
  });

  it('does not leak identity: pseudonymous id and an age group', () => {
    const row = rows[0]!;
    expect(row.user_id).toBe(pseudonym(42, 'salt'));
    expect(row.user_id).not.toContain('42');
    expect(pseudonym(42, 'other salt')).not.toBe(row.user_id);
    expect(row.age_group).toBe(20);
    expect(ageGroup(37)).toBe(35);
  });

  it('writes a CSV with the shared header', () => {
    const [header, first] = toCsv(rows).split('\n');
    expect(header).toBe(EXPORT_COLUMNS.join(','));
    expect(first?.split(',')).toHaveLength(EXPORT_COLUMNS.length);
  });
});
