import type { Profile } from '@ai-coach/shared';
import { SEEDED_LIBRARY } from '../db/seed-library.js';

export const LIBRARY = SEEDED_LIBRARY;

export const PROFILE: Profile = {
  goal: 'muscle_gain',
  sex: 'male',
  age: 22,
  heightCm: 172,
  weightKg: 68,
  level: 'intermediate',
  injuries: '',
  sessionsPerWeek: 4,
  sessionMinutes: 60,
  preferredDays: [],
  location: 'gym',
  equipment: ['barbell', 'dumbbell', 'machine', 'pullup_bar', 'band', 'bodyweight'],
};
