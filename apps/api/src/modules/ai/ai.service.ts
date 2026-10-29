import {
  addDays,
  aiChatOutputSchema,
  aiNutritionOutputSchema,
  aiRequestSchema,
  aiReviewOutputSchema,
  mondayOf,
  nutritionDaySchema,
  type AiChatOutput,
  type AiMeta,
  type AiNutritionOutput,
  type AiPlanOutput,
  type AiRequest,
  type AiReviewOutput,
  type AiStatus,
  type ChatMessage,
  type Exercise,
  type NutritionDay,
  type Plan,
  type SessionInput,
  type WeekStats,
  type WorkoutSummary,
} from '@ai-coach/shared';
import { AppError } from '../../lib/http.js';
import type { ExerciseService } from '../exercises/exercise.service.js';
import type { PlanService } from '../plans/plan.service.js';
import type { ProfileService } from '../profile/profile.service.js';
import type { WeightService } from '../workouts/weight.service.js';
import type { WorkoutService } from '../workouts/workout.service.js';
import { AiRequestModel, NutritionDayModel } from './ai.model.js';
import { runStructured, type AiLogger, type LlmClient } from './llm.service.js';
import { CHAT_PROMPT_VERSION, chatMessages } from './prompts/chat.v1.js';
import { EXPLAIN_PROMPT_VERSION, explainMessages } from './prompts/explain.v1.js';
import { NUTRITION_PROMPT_VERSION } from './prompts/nutrition.v1.js';
import { PLAN_PROMPT_VERSION } from './prompts/plan.v1.js';
import { nutritionTask, planTask } from './tasks.js';
import { CHAT_FALLBACK, templateReview } from './templates.js';

export const PROMPT_VERSIONS = {
  plan: PLAN_PROMPT_VERSION,
  nutrition: NUTRITION_PROMPT_VERSION,
  explain: EXPLAIN_PROMPT_VERSION,
  chat: CHAT_PROMPT_VERSION,
} as const;

export interface AiService {
  generatePlan(userId: number, weekStart: string): Promise<{ plan: Plan; meta: AiMeta }>;
  generateNutrition(
    userId: number,
    date: string,
  ): Promise<{ nutrition: NutritionDay; meta: AiMeta }>;
  getNutrition(userId: number, date: string): Promise<NutritionDay>;
  review(
    userId: number,
    weekStart: string,
  ): Promise<{ stats: WeekStats; review: AiReviewOutput; meta: AiMeta }>;
  chat(userId: number, messages: ChatMessage[]): Promise<AiChatOutput & { meta: AiMeta }>;
  listRequests(userId: number, limit: number): Promise<AiRequest[]>;
  status(): AiStatus;
}

export interface AiServiceDeps {
  llm: LlmClient;
  profiles: ProfileService;
  exercises: ExerciseService;
  plans: PlanService;
  workouts: WorkoutService;
  weights: WeightService;
  think: boolean;
  timeoutMs: number;
  requestsPerHour: number;
}

/** Writes one row per AI call to ai_requests (the data behind the LLM experiment). */
export const logToDatabase: AiLogger = async (entry) => {
  const row = await AiRequestModel.create({
    ...entry,
    violations: JSON.stringify(entry.violations),
  });
  return row.id;
};

function toSessions(output: AiPlanOutput, library: readonly Exercise[]): SessionInput[] {
  const idOf = new Map(library.map((e) => [e.slug, e.id]));
  return output.sessions.map((s) => ({
    day: s.day,
    title: s.title.trim().slice(0, 60),
    durationMin: s.durationMin,
    notes: '',
    exercises: s.exercises.map((e) => ({
      exerciseId: idOf.get(e.slug) ?? 0,
      sets: e.sets,
      reps: e.reps.trim(),
      weightKg: null,
      restSeconds: e.restSeconds,
    })),
  }));
}

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const round1 = (n: number) => Math.round(n * 10) / 10;

function inWeek(w: WorkoutSummary, weekStart: string): boolean {
  return mondayOf(new Date(w.startedAt)) === weekStart;
}

export function createAiService(deps: AiServiceDeps, log: AiLogger = logToDatabase): AiService {
  const { llm, profiles, exercises, plans, workouts, weights } = deps;

  async function planOrNull(userId: number, weekStart: string): Promise<Plan | null> {
    try {
      return await plans.getWeek(userId, weekStart);
    } catch (err) {
      if (err instanceof AppError && err.status === 404) return null;
      throw err;
    }
  }

  async function weekStats(userId: number, weekStart: string): Promise<WeekStats> {
    const prevStart = addDays(weekStart, -7);
    const [plan, logged, weightRows] = await Promise.all([
      planOrNull(userId, weekStart),
      workouts.list(userId, { from: new Date(`${prevStart}T00:00:00`), limit: 100 }),
      weights.list(userId, addDays(weekStart, -7)),
    ]);
    const thisWeek = logged.filter((w) => inWeek(w, weekStart));
    const lastWeek = logged.filter((w) => inWeek(w, prevStart));
    const planned = plan?.sessions.length ?? 0;
    const completed = plan?.sessions.filter((s) => s.completedAt !== null).length ?? 0;
    const rpes = thisWeek.map((w) => w.avgRpe).filter((r): r is number => r !== null);
    const end = addDays(weekStart, 6);
    const inRange = weightRows.filter((r) => r.date >= weekStart && r.date <= end);
    // Start of week: last reading before Monday if any, otherwise the first one inside the week.
    const before = weightRows.filter((r) => r.date < weekStart).at(-1);
    return {
      weekStart,
      plannedSessions: planned,
      completedSessions: completed,
      completionPct: planned ? Math.round((completed / planned) * 100) : null,
      workouts: thisWeek.length,
      totalSets: sum(thisWeek.map((w) => w.setCount)),
      volumeKg: round1(sum(thisWeek.map((w) => w.volumeKg))),
      avgRpe: rpes.length ? round1(sum(rpes) / rpes.length) : null,
      previousVolumeKg: round1(sum(lastWeek.map((w) => w.volumeKg))),
      previousWorkouts: lastWeek.length,
      weightStartKg: (before ?? inRange[0])?.weightKg ?? null,
      weightEndKg: inRange.at(-1)?.weightKg ?? null,
    };
  }

  async function saveNutrition(
    userId: number,
    date: string,
    source: 'ai' | 'template',
    output: AiNutritionOutput,
  ): Promise<NutritionDay> {
    const data = JSON.stringify(output);
    const existing = await NutritionDayModel.findOne({ where: { userId, date } });
    const row = existing
      ? await existing.update({ source, data })
      : await NutritionDayModel.create({ userId, date, source, data });
    return toNutritionDay(row);
  }

  function toNutritionDay(row: NutritionDayModel): NutritionDay {
    const parsed = aiNutritionOutputSchema.parse(JSON.parse(row.data));
    return nutritionDaySchema.parse({
      date: row.date,
      source: row.source,
      ...parsed,
      createdAt: row.updatedAt.toISOString(),
    });
  }

  return {
    async generatePlan(userId, weekStart) {
      const profile = await profiles.get(userId);
      const library = await exercises.list({});
      const result = await runStructured(llm, log, planTask(userId, profile, library));
      const plan = await plans.replaceWeek(
        userId,
        weekStart,
        result.meta.usedFallback ? 'template' : 'ai',
        result.data.summary.slice(0, 1000),
        toSessions(result.data, library),
      );
      return { plan, meta: result.meta };
    },

    async generateNutrition(userId, date) {
      const profile = await profiles.get(userId);
      const result = await runStructured(llm, log, nutritionTask(userId, profile));
      const source = result.meta.usedFallback ? 'template' : 'ai';
      return {
        nutrition: await saveNutrition(userId, date, source, result.data),
        meta: result.meta,
      };
    },

    async getNutrition(userId, date) {
      const row = await NutritionDayModel.findOne({ where: { userId, date } });
      if (!row)
        throw new AppError(404, 'NUTRITION_NOT_FOUND', 'Chưa có gợi ý dinh dưỡng cho ngày này');
      return toNutritionDay(row);
    },

    async review(userId, weekStart) {
      const profile = await profiles.get(userId);
      const stats = await weekStats(userId, weekStart);
      const result = await runStructured(llm, log, {
        userId,
        task: 'explain',
        promptVersion: EXPLAIN_PROMPT_VERSION,
        messages: explainMessages(profile, stats),
        schema: aiReviewOutputSchema,
        check: () => [],
        fallback: () => templateReview(stats),
      });
      return { stats, review: result.data, meta: result.meta };
    },

    async chat(userId, messages) {
      const profile = await profiles.get(userId);
      const weekStart = mondayOf(new Date());
      const [plan, recent, weightRows] = await Promise.all([
        planOrNull(userId, weekStart),
        workouts.list(userId, { limit: 5 }),
        weights.list(userId, addDays(weekStart, -28)),
      ]);
      const result = await runStructured(llm, log, {
        userId,
        task: 'chat',
        promptVersion: CHAT_PROMPT_VERSION,
        temperature: 0.5,
        messages: chatMessages(
          {
            profile,
            plan: (plan?.sessions ?? []).map((s) => ({
              day: s.day,
              title: s.title,
              exercises: s.exercises.map((e) => `${e.exercise.name} ${e.sets}x${e.reps}`),
              done: s.completedAt !== null,
            })),
            recentWorkouts: recent.map((w) => ({
              date: w.startedAt.slice(0, 10),
              title: w.title,
              volumeKg: w.volumeKg,
              avgRpe: w.avgRpe,
            })),
            latestWeightKg: weightRows.at(-1)?.weightKg ?? null,
          },
          messages,
        ),
        schema: aiChatOutputSchema,
        check: () => [],
        fallback: () => CHAT_FALLBACK,
      });
      return { ...result.data, meta: result.meta };
    },

    async listRequests(userId, limit) {
      const rows = await AiRequestModel.findAll({
        where: { userId },
        order: [['createdAt', 'DESC']],
        limit,
      });
      return rows.map((r) =>
        aiRequestSchema.parse({
          id: r.id,
          task: r.task,
          model: r.model,
          promptVersion: r.promptVersion,
          latencyMs: r.latencyMs,
          schemaValid: Boolean(r.schemaValid),
          retryCount: r.retryCount,
          violations: JSON.parse(r.violations) as unknown,
          usedFallback: Boolean(r.usedFallback),
          error: r.error,
          createdAt: r.createdAt.toISOString(),
        }),
      );
    },

    status() {
      return {
        model: llm.model,
        think: deps.think,
        timeoutMs: deps.timeoutMs,
        promptVersions: { ...PROMPT_VERSIONS },
        requestsPerHour: deps.requestsPerHour,
      };
    },
  };
}
