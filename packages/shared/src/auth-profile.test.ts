import { describe, expect, it } from 'vitest';
import { loginSchema, passwordStrength, registerSchema } from './auth.js';
import { fieldErrors } from './errors.js';
import { profileSchema, type Profile } from './profile.js';

describe('registerSchema', () => {
  it('normalises email and accepts a strong password', () => {
    const r = registerSchema.parse({
      fullName: '  Nguyễn Minh ',
      email: ' Minh@Email.COM ',
      password: 'Squat2026',
      acceptTerms: true,
    });
    expect(r.email).toBe('minh@email.com');
    expect(r.fullName).toBe('Nguyễn Minh');
  });

  it('reports one Vietnamese message per field', () => {
    const r = registerSchema.safeParse({
      fullName: 'M',
      email: 'x',
      password: 'abc',
      acceptTerms: false,
    });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(Object.keys(fieldErrors(r.error)).sort()).toEqual([
        'acceptTerms',
        'email',
        'fullName',
        'password',
      ]);
    }
  });

  it('login only needs a non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.vn', password: 'x' }).success).toBe(true);
  });
});

describe('passwordStrength', () => {
  it('scores by rule count', () => {
    expect(passwordStrength('short')).toBe(0);
    expect(passwordStrength('alllowercase')).toBe(1);
    expect(passwordStrength('Squat2026')).toBe(3);
    expect(passwordStrength('Squat2026!')).toBe(4);
  });
});

describe('profileSchema', () => {
  const valid: Profile = {
    goal: 'muscle_gain',
    sex: 'male',
    age: 21,
    heightCm: 170,
    weightKg: 68,
    level: 'intermediate',
    injuries: 'Đau gối trái khi xuống sâu',
    sessionsPerWeek: 4,
    sessionMinutes: 60,
    preferredDays: ['mon', 'wed', 'thu', 'sun'],
    location: 'gym',
    equipment: ['barbell', 'dumbbell'],
  };

  it('accepts a complete profile', () => {
    expect(profileSchema.parse(valid)).toEqual(valid);
  });

  it('requires enough preferred days for the chosen sessions, unless left empty', () => {
    expect(profileSchema.safeParse({ ...valid, preferredDays: ['mon', 'wed'] }).success).toBe(
      false,
    );
    expect(profileSchema.safeParse({ ...valid, preferredDays: [] }).success).toBe(true);
  });

  it('rejects out-of-range body metrics and unknown durations', () => {
    const r = profileSchema.safeParse({ ...valid, heightCm: 90, sessionMinutes: 50 });
    expect(r.success).toBe(false);
    if (!r.success)
      expect(Object.keys(fieldErrors(r.error)).sort()).toEqual(['heightCm', 'sessionMinutes']);
  });
});
