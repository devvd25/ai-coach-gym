import type { User } from '@ai-coach/shared';

/** Where a signed-in user must go before using the app, or null when setup is complete. */
export function nextStep(user: User): '/dong-y' | '/onboarding' | null {
  if (!user.healthConsentAt) return '/dong-y';
  if (!user.hasProfile) return '/onboarding';
  return null;
}
