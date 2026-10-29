import type { NutritionTargets, Profile } from '@ai-coach/shared';

/** Lowest daily intake the app will ever recommend without medical supervision. */
export const MIN_KCAL = { male: 1500, female: 1200 } as const;

/** Grams of protein per kg body weight by goal, and the accepted range for any plan. */
export const PROTEIN_PER_KG = { fat_loss: 1.8, muscle_gain: 2.0, maintain: 1.6 } as const;
export const PROTEIN_RANGE_PER_KG = [1.2, 2.4] as const;

const GOAL_KCAL_ADJUST = { fat_loss: -400, muscle_gain: 250, maintain: 0 } as const;

/** Mifflin–St Jeor resting energy expenditure (kcal/day). */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

/** 2 sessions/week ≈ light (1.35) up to 6 sessions ≈ very active (1.65). */
export function activityFactor(sessionsPerWeek: number): number {
  return Math.min(1.7, Math.max(1.2, 1.2 + 0.075 * sessionsPerWeek));
}

export function referenceTargets(p: Profile): NutritionTargets {
  const tdee = bmr(p) * activityFactor(p.sessionsPerWeek);
  const kcal = Math.max(MIN_KCAL[p.sex], Math.round((tdee + GOAL_KCAL_ADJUST[p.goal]) / 10) * 10);
  const proteinG = Math.round(p.weightKg * PROTEIN_PER_KG[p.goal]);
  const fatG = Math.round(p.weightKg * 0.9);
  const carbG = Math.max(0, Math.round((kcal - proteinG * 4 - fatG * 9) / 4));
  const waterL = Math.round(p.weightKg * 0.035 * 10) / 10;
  return { kcal, proteinG, carbG, fatG, waterL };
}
