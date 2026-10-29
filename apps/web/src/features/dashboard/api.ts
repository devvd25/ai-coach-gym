import { dashboardSchema } from '@ai-coach/shared';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export function useDashboard(weeks: number) {
  return useQuery({
    queryKey: ['dashboard', weeks],
    queryFn: ({ signal }) =>
      api(`/api/stats/dashboard?weeks=${weeks}`, { schema: dashboardSchema, signal }),
  });
}
