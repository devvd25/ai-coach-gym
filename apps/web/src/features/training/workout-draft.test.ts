import type { Session } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import { draftFromSession, formatClock, targetReps, toWorkoutInput } from './workout-draft.js';

const session: Session = {
  id: 5,
  planId: 1,
  day: 'wed',
  title: 'Thân dưới A',
  durationMin: 50,
  notes: '',
  completedAt: null,
  exercises: [
    {
      id: 1,
      exerciseId: 10,
      sets: 2,
      reps: '8-10',
      weightKg: 52.5,
      restSeconds: 90,
      exercise: {
        id: 10,
        slug: 'romanian-deadlift',
        name: 'Romanian Deadlift',
        muscleGroup: 'legs',
        cameraSupported: false,
      },
    },
    {
      id: 2,
      exerciseId: 11,
      sets: 1,
      reps: '45s',
      weightKg: null,
      restSeconds: 60,
      exercise: {
        id: 11,
        slug: 'plank',
        name: 'Plank',
        muscleGroup: 'core',
        cameraSupported: false,
      },
    },
  ],
};

const meta = {
  sessionId: 5,
  title: 'Thân dưới A',
  startedAt: '2026-10-28T18:00:00+07:00',
  finishedAt: '2026-10-28T18:50:00+07:00',
  notes: '',
  feeling: 'right' as const,
};

describe('workout draft', () => {
  it('reads the first number of a rep target', () => {
    expect(targetReps('8-10')).toBe(8);
    expect(targetReps('45s')).toBe(45);
    expect(targetReps('12')).toBe(12);
  });

  it('pre-fills one row per planned set with target reps and load', () => {
    const d = draftFromSession(session);
    expect(d[0]?.sets).toEqual([
      { reps: '8', weightKg: '52,5', rpe: '', done: false },
      { reps: '8', weightKg: '52,5', rpe: '', done: false },
    ]);
    expect(d[1]?.sets[0]).toMatchObject({ reps: '45', weightKg: '' });
  });

  it('logs only ticked sets, keeps their set number and rounds RPE to halves', () => {
    const d = draftFromSession(session);
    d[0]!.sets[1] = { reps: '9', weightKg: '52,5', rpe: '7.3', done: true };
    d[1]!.sets[0] = { reps: '50', weightKg: '', rpe: '', done: true };
    expect(toWorkoutInput(d, meta)?.sets).toEqual([
      { exerciseId: 10, setNumber: 2, reps: 9, weightKg: 52.5, rpe: 7.5 },
      { exerciseId: 11, setNumber: 1, reps: 50, weightKg: null, rpe: null },
    ]);
  });

  it('returns null when no set is ticked', () => {
    expect(toWorkoutInput(draftFromSession(session), meta)).toBeNull();
  });

  it('formats clocks', () => {
    expect(formatClock(72)).toBe('01:12');
    expect(formatClock(3725)).toBe('1:02:05');
  });
});
