import {
  aiNutritionOutputSchema,
  buildAiPlanOutputSchema,
  DAYS,
  type AiNutritionOutput,
  type AiPlanOutput,
  type Day,
  type Exercise,
  type Profile,
} from '@ai-coach/shared';
import { AppError } from '../../lib/http.js';
import type { StructuredTask } from './llm.service.js';
import { referenceTargets } from './nutrition-reference.js';
import { NUTRITION_PROMPT_VERSION, nutritionMessages } from './prompts/nutrition.v1.js';
import { PLAN_PROMPT_VERSION, planMessages } from './prompts/plan.v1.js';
import { PLAN_V2_PROMPT_VERSION, planMessagesV2 } from './prompts/plan.v2.js';
import { allowedExercises, checkNutrition, checkPlan } from './safety-rules.js';
import { templateNutrition, templatePlan } from './templates.js';

/*
 * The plan and nutrition tasks without any database access, so the API and the LLM benchmark
 * (scripts/benchmark-llm.ts) send exactly the same prompt, schema and safety rules.
 */

/** Every plan prompt stays available so versions can be benchmarked against each other. */
export const PLAN_VERSIONS = {
  [PLAN_PROMPT_VERSION]: { messages: planMessages, strict: false },
  [PLAN_V2_PROMPT_VERSION]: { messages: planMessagesV2, strict: true },
} as const;
export type PlanVersion = keyof typeof PLAN_VERSIONS;

/**
 * Version used by the app (POST /api/ai/plan) and by default in the benchmark. plan.v2 since
 * 29/10/2026: 0 retries / 0 fallbacks on the 30 profiles vs 4 / 1 for plan.v1 (docs/experiments.md).
 */
export const CURRENT_PLAN_VERSION: PlanVersion = PLAN_V2_PROMPT_VERSION;

export function planTask(
  userId: number,
  profile: Profile,
  library: readonly Exercise[],
  version: PlanVersion = CURRENT_PLAN_VERSION,
): StructuredTask<AiPlanOutput> {
  const prompt = PLAN_VERSIONS[version];
  const allowed = allowedExercises(profile, library);
  const [first, ...rest] = allowed.map((e) => e.slug);
  if (!first) {
    throw new AppError(
      422,
      'NO_EXERCISES',
      'Không có bài tập phù hợp với dụng cụ và hạn chế của bạn',
    );
  }
  return {
    userId,
    task: 'plan',
    promptVersion: version,
    messages: prompt.messages(profile, allowed),
    schema: buildAiPlanOutputSchema({
      slugs: [first, ...rest],
      days: profile.preferredDays.length ? ([...profile.preferredDays] as [Day, ...Day[]]) : DAYS,
      sessions: profile.sessionsPerWeek,
      strict: prompt.strict,
    }),
    check: (out) => checkPlan(out, profile, library),
    fallback: () => templatePlan(profile, library),
  };
}

export function nutritionTask(userId: number, profile: Profile): StructuredTask<AiNutritionOutput> {
  return {
    userId,
    task: 'nutrition',
    promptVersion: NUTRITION_PROMPT_VERSION,
    messages: nutritionMessages(profile, referenceTargets(profile)),
    schema: aiNutritionOutputSchema,
    check: (out) => checkNutrition(out, profile),
    fallback: () => templateNutrition(profile),
  };
}
