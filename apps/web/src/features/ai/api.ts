import {
  aiChatResponseSchema,
  aiNutritionResponseSchema,
  aiPlanResponseSchema,
  aiRequestListSchema,
  aiReviewResponseSchema,
  aiStatusSchema,
  nutritionDaySchema,
  type ChatMessage,
} from '@ai-coach/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api.js';

function useInvalidateRequests() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['ai-requests'] });
}

export function useGeneratePlan() {
  const qc = useQueryClient();
  const invalidateRequests = useInvalidateRequests();
  return useMutation({
    mutationFn: (weekStart: string) =>
      api('/api/ai/plan', { method: 'POST', body: { weekStart }, schema: aiPlanResponseSchema }),
    onSuccess: async (res) => {
      qc.setQueryData(['plan', res.plan.weekStart], res.plan);
      await invalidateRequests();
    },
  });
}

/** null means "no suggestion for this day yet" (the API answers 404). */
export function useNutrition(date: string) {
  return useQuery({
    queryKey: ['nutrition', date],
    queryFn: async ({ signal }) => {
      try {
        return await api(`/api/nutrition/${date}`, { schema: nutritionDaySchema, signal });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'NUTRITION_NOT_FOUND') return null;
        throw err;
      }
    },
  });
}

export function useGenerateNutrition() {
  const qc = useQueryClient();
  const invalidateRequests = useInvalidateRequests();
  return useMutation({
    mutationFn: (date: string) =>
      api('/api/ai/nutrition', {
        method: 'POST',
        body: { date },
        schema: aiNutritionResponseSchema,
      }),
    onSuccess: async (res) => {
      qc.setQueryData(['nutrition', res.nutrition.date], res.nutrition);
      await invalidateRequests();
    },
  });
}

export function useReview() {
  const invalidateRequests = useInvalidateRequests();
  return useMutation({
    mutationFn: (weekStart: string) =>
      api('/api/ai/review', {
        method: 'POST',
        body: { weekStart },
        schema: aiReviewResponseSchema,
      }),
    onSuccess: invalidateRequests,
  });
}

export function useChat() {
  const invalidateRequests = useInvalidateRequests();
  return useMutation({
    mutationFn: (messages: ChatMessage[]) =>
      api('/api/ai/chat', { method: 'POST', body: { messages }, schema: aiChatResponseSchema }),
    onSuccess: invalidateRequests,
  });
}

export function useAiRequests(limit = 10) {
  return useQuery({
    queryKey: ['ai-requests', limit],
    queryFn: ({ signal }) =>
      api(`/api/ai/requests?limit=${limit}`, { schema: aiRequestListSchema, signal }),
  });
}

export function useAiStatus() {
  return useQuery({
    queryKey: ['ai-status'],
    queryFn: ({ signal }) => api('/api/ai/status', { schema: aiStatusSchema, signal }),
    staleTime: 10 * 60_000,
  });
}

/** Seconds since `active` became true; generations take 5–60 s on a local GPU. */
export function useElapsed(active: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!active) return;
    setSeconds(0);
    const started = Date.now();
    const timer = window.setInterval(
      () => setSeconds(Math.floor((Date.now() - started) / 1000)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [active]);
  return seconds;
}
