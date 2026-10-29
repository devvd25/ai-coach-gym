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
import { allowedExercises, checkNutrition, checkPlan } from './safety-rules.js';
import { templateNutrition, templatePlan } from './templates.js';

/*
 * The plan and nutrition tasks without any database access, so the API and the LLM benchmark
 * (scripts/benchmark-llm.ts) send exactly the same prompt, schema and safety rules.
 */

export function planTask(
  userId: number,
  profile: Profile,
  library: readonly Exercise[],
): StructuredTask<AiPlanOutput> {
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
    promptVersion: PLAN_PROMPT_VERSION,
    messages: planMessages(profile, allowed),
    schema: buildAiPlanOutputSchema({
      slugs: [first, ...rest],
      days: profile.preferredDays.length ? ([...profile.preferredDays] as [Day, ...Day[]]) : DAYS,
      sessions: profile.sessionsPerWeek,
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
