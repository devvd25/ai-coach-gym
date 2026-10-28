import type { User } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import { nextStep } from './next-step.js';

const user: User = {
  id: 1,
  email: 'minh@email.com',
  fullName: 'Nguyễn Minh',
  healthConsentAt: null,
  consents: { camera: false, research: false },
  hasProfile: false,
};

describe('nextStep', () => {
  it('sends new users to consent first, then onboarding, then the app', () => {
    expect(nextStep(user)).toBe('/dong-y');
    const consented = { ...user, healthConsentAt: '2026-10-28T10:00:00.000+07:00' };
    expect(nextStep(consented)).toBe('/onboarding');
    expect(nextStep({ ...consented, hasProfile: true })).toBeNull();
  });
});
