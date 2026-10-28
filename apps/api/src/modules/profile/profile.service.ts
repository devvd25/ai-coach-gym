import type { Profile } from '@ai-coach/shared';
import { AppError } from '../../lib/http.js';
import type { ProfileRepository } from './profile.repository.js';

export interface ProfileService {
  get(userId: number): Promise<Profile>;
  save(userId: number, profile: Profile): Promise<Profile>;
}

export function createProfileService(profiles: ProfileRepository): ProfileService {
  return {
    async get(userId) {
      const profile = await profiles.get(userId);
      if (!profile) throw new AppError(404, 'PROFILE_NOT_FOUND', 'Bạn chưa tạo hồ sơ');
      return profile;
    },
    save: (userId, profile) => profiles.upsert(userId, profile),
  };
}
