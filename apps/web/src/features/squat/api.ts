import {
  squatSessionListSchema,
  squatSessionSchema,
  type SquatSessionInput,
} from '@ai-coach/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export function useSquatSessions(days = 90) {
  return useQuery({
    queryKey: ['squat-sessions', days],
    queryFn: ({ signal }) =>
      api(`/api/squat-sessions?days=${days}`, { schema: squatSessionListSchema, signal }),
  });
}

export function useSaveSquatSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SquatSessionInput) =>
      api('/api/squat-sessions', { method: 'POST', body: input, schema: squatSessionSchema }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['squat-sessions'] }),
  });
}
