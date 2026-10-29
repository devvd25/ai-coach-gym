import {
  exerciseListSchema,
  planSchema,
  sessionSchema,
  weightEntrySchema,
  weightListSchema,
  workoutListSchema,
  workoutSchema,
  type SessionInput,
  type WorkoutInput,
} from '@ai-coach/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { api, ApiError } from '../../lib/api.js';

/** The whole library (~40 rows) is fetched once and filtered in the browser. */
export function useExercises() {
  return useQuery({
    queryKey: ['exercises'],
    queryFn: ({ signal }) => api('/api/exercises', { schema: exerciseListSchema, signal }),
    staleTime: 60 * 60_000,
  });
}

/** null means "no plan for this week yet" (the API answers 404). */
export function usePlan(weekStart: string) {
  return useQuery({
    queryKey: ['plan', weekStart],
    queryFn: async ({ signal }) => {
      try {
        return await api(`/api/plans/week/${weekStart}`, { schema: planSchema, signal });
      } catch (err) {
        if (err instanceof ApiError && err.code === 'PLAN_NOT_FOUND') return null;
        throw err;
      }
    },
  });
}

export function useSession(id: number) {
  return useQuery({
    queryKey: ['session', id],
    queryFn: ({ signal }) => api(`/api/sessions/${id}`, { schema: sessionSchema, signal }),
  });
}

function useInvalidatePlans() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ['plan'] });
}

export function useCreatePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: (weekStart: string) =>
      api('/api/plans', { method: 'POST', body: { weekStart }, schema: planSchema }),
    onSuccess: invalidate,
  });
}

export function useSaveSession() {
  const invalidate = useInvalidatePlans();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { planId: number; sessionId?: number; input: SessionInput }) =>
      v.sessionId
        ? api(`/api/sessions/${v.sessionId}`, {
            method: 'PUT',
            body: v.input,
            schema: sessionSchema,
          })
        : api(`/api/plans/${v.planId}/sessions`, {
            method: 'POST',
            body: v.input,
            schema: sessionSchema,
          }),
    onSuccess: async (s) => {
      qc.setQueryData(['session', s.id], s);
      await invalidate();
    },
  });
}

export function useDeleteSession() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: (id: number) => api(`/api/sessions/${id}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: invalidate,
  });
}

export function useSetCompleted() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: (v: { id: number; completed: boolean }) =>
      api(`/api/sessions/${v.id}/completion`, {
        method: 'PUT',
        body: { completed: v.completed },
        schema: sessionSchema,
      }),
    onSuccess: invalidate,
  });
}

export function useWorkouts(days = 90) {
  return useQuery({
    queryKey: ['workouts', days],
    queryFn: ({ signal }) =>
      api(`/api/workouts?days=${days}`, { schema: workoutListSchema, signal }),
  });
}

export function useWorkout(id: number) {
  return useQuery({
    queryKey: ['workout', id],
    queryFn: ({ signal }) => api(`/api/workouts/${id}`, { schema: workoutSchema, signal }),
  });
}

export function useLogWorkout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: WorkoutInput) =>
      api('/api/workouts', { method: 'POST', body: input, schema: workoutSchema }),
    onSuccess: async (w) => {
      qc.setQueryData(['workout', w.id], w);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ['workouts'] }),
        qc.invalidateQueries({ queryKey: ['plan'] }),
      ]);
    },
  });
}

export function useWeights(days = 180) {
  return useQuery({
    queryKey: ['weights', days],
    queryFn: ({ signal }) => api(`/api/weights?days=${days}`, { schema: weightListSchema, signal }),
  });
}

export function useSaveWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { date: string; weightKg: number; note: string }) =>
      api(`/api/weights/${v.date}`, {
        method: 'PUT',
        body: { weightKg: v.weightKg, note: v.note },
        schema: weightEntrySchema,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weights'] }),
  });
}

export function useDeleteWeight() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (date: string) =>
      api(`/api/weights/${date}`, { method: 'DELETE', schema: z.null() }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['weights'] }),
  });
}
