import { describe, expect, it } from 'vitest';
import { addDays, dateOfDay, dayOf, mondayOf, weekStartSchema } from './dates.js';
import { filterExercises, normalizeSearch, type Exercise } from './exercise.js';
import { repsSchema, sessionInputSchema, totalSets } from './plan.js';
import { averageRpe, durationMinutes, volumeKg, workoutInputSchema } from './workout.js';

describe('dates', () => {
  it('finds the Monday of a week, across month and year ends', () => {
    expect(mondayOf('2026-10-28')).toBe('2026-10-26'); // Wednesday
    expect(mondayOf('2026-11-01')).toBe('2026-10-26'); // Sunday belongs to the same week
    expect(mondayOf('2027-01-01')).toBe('2026-12-28');
  });

  it('maps weekdays to dates and back', () => {
    expect(dateOfDay('2026-10-26', 'wed')).toBe('2026-10-28');
    expect(dayOf('2026-11-01')).toBe('sun');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });

  it('only accepts Mondays as week starts', () => {
    expect(weekStartSchema.safeParse('2026-10-26').success).toBe(true);
    expect(weekStartSchema.safeParse('2026-10-27').success).toBe(false);
  });
});

describe('exercise search', () => {
  const ex = (name: string, extra: Partial<Exercise> = {}): Exercise => ({
    id: 1,
    slug: 'x',
    name,
    muscleGroup: 'legs',
    secondaryMuscles: 'Đùi sau, mông',
    equipment: 'barbell',
    level: 'beginner',
    description: '',
    steps: [],
    mistakes: [],
    cameraSupported: false,
    defaultSets: 3,
    defaultReps: '8-12',
    restSeconds: 90,
    ...extra,
  });

  it('ignores Vietnamese accents and case', () => {
    expect(normalizeSearch('Đẩy Ngực')).toBe('day nguc');
    const list = [ex('Squat'), ex('Đẩy ngực', { muscleGroup: 'chest', secondaryMuscles: '' })];
    expect(filterExercises(list, { q: 'day nguc' }).map((e) => e.name)).toEqual(['Đẩy ngực']);
    expect(filterExercises(list, { q: 'dui sau' }).map((e) => e.name)).toEqual(['Squat']);
    // The muscle group label is searchable too: "ngực" finds chest exercises by any name.
    expect(filterExercises(list, { q: 'nguc' }).map((e) => e.name)).toEqual(['Đẩy ngực']);
    expect(filterExercises(list, { q: 'chân' }).map((e) => e.name)).toEqual(['Squat']);
  });

  it('combines filters', () => {
    const list = [ex('A'), ex('B', { equipment: 'machine' }), ex('C', { muscleGroup: 'chest' })];
    expect(
      filterExercises(list, { muscle: 'legs', equipment: 'machine' }).map((e) => e.name),
    ).toEqual(['B']);
  });
});

describe('plan input', () => {
  it('accepts fixed, ranged and timed reps', () => {
    for (const r of ['8', '8-12', '45s']) expect(repsSchema.safeParse(r).success).toBe(true);
    for (const r of ['', 'tám', '8–12', '-3']) expect(repsSchema.safeParse(r).success).toBe(false);
  });

  it('requires at least one exercise and counts sets', () => {
    const base = { day: 'wed', title: 'Thân dưới A', durationMin: 50, notes: '', exercises: [] };
    expect(sessionInputSchema.safeParse(base).success).toBe(false);
    expect(totalSets([{ sets: 4 }, { sets: 3 }])).toBe(7);
  });
});

describe('workout maths', () => {
  const sets = [
    { reps: 8, weightKg: 60, rpe: 7 },
    { reps: 8, weightKg: 60, rpe: 8 },
    { reps: 45, weightKg: null, rpe: null },
  ];

  it('computes volume from loaded sets only and averages rated RPE', () => {
    expect(volumeKg(sets)).toBe(960);
    expect(averageRpe(sets)).toBe(7.5);
    expect(averageRpe([{ rpe: null }])).toBeNull();
  });

  it('rounds duration to whole minutes and rejects an end before the start', () => {
    expect(durationMinutes('2026-10-28T18:00:00+07:00', '2026-10-28T18:52:10+07:00')).toBe(52);
    const w = {
      sessionId: null,
      title: 'Buổi tự do',
      startedAt: '2026-10-28T18:00:00+07:00',
      finishedAt: '2026-10-28T17:00:00+07:00',
      notes: '',
      feeling: null,
      sets: [{ exerciseId: 1, setNumber: 1, reps: 8, weightKg: 60, rpe: 7 }],
    };
    expect(workoutInputSchema.safeParse(w).success).toBe(false);
  });
});
