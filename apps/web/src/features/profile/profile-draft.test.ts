import type { Profile } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import {
  draftFromProfile,
  emptyDraft,
  toggleIn,
  validateBodyStep,
  validateProfile,
  type ProfileDraft,
} from './profile-draft.js';

const filled: ProfileDraft = {
  ...emptyDraft,
  goal: 'muscle_gain',
  sex: 'male',
  age: '21',
  heightCm: '170',
  weightKg: '68,4',
  level: 'intermediate',
  sessionsPerWeek: 4,
  equipment: ['barbell'],
};

describe('profile draft', () => {
  it('accepts decimal commas and produces a valid profile', () => {
    const r = validateProfile(filled);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.profile.weightKg).toBe(68.4);
  });

  it('asks for every body field on an empty first step', () => {
    expect(Object.keys(validateBodyStep(emptyDraft)).sort()).toEqual([
      'age',
      'goal',
      'heightCm',
      'level',
      'sex',
      'weightKg',
    ]);
  });

  it('first step ignores schedule fields', () => {
    expect(validateBodyStep({ ...filled, equipment: [] })).toEqual({});
  });

  it('round-trips a saved profile back into the form', () => {
    const r = validateProfile(filled);
    if (!r.ok) throw new Error('expected valid');
    const back = draftFromProfile(r.profile as Profile);
    expect(back.weightKg).toBe('68,4');
    expect(validateProfile(back)).toEqual(r);
  });

  it('toggleIn adds and removes', () => {
    expect(toggleIn(['mon'], 'wed')).toEqual(['mon', 'wed']);
    expect(toggleIn(['mon', 'wed'], 'mon')).toEqual(['wed']);
  });
});
