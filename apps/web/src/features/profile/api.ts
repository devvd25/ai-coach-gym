import { profileSchema, type Profile } from '@ai-coach/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api.js';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: ({ signal }) => api('/api/profile', { schema: profileSchema, signal }),
  });
}

export function useSaveProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Profile) =>
      api('/api/profile', { method: 'PUT', body: profile, schema: profileSchema }),
    onSuccess: async (profile) => {
      queryClient.setQueryData(['profile'], profile);
      await queryClient.invalidateQueries({ queryKey: ['me'] });
    },
  });
}
