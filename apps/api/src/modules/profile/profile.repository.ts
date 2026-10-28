import { profileSchema, type Profile } from '@ai-coach/shared';
import { ProfileModel } from './profile.model.js';

export interface ProfileRepository {
  get(userId: number): Promise<Profile | null>;
  upsert(userId: number, profile: Profile): Promise<Profile>;
}

function toProfile(row: ProfileModel): Profile {
  // Re-validate on read so a hand-edited row never reaches the client in a broken shape.
  return profileSchema.parse({
    goal: row.goal,
    sex: row.sex,
    age: row.age,
    heightCm: Number(row.heightCm),
    weightKg: Number(row.weightKg),
    level: row.level,
    injuries: row.injuries,
    sessionsPerWeek: row.sessionsPerWeek,
    sessionMinutes: row.sessionMinutes,
    preferredDays: JSON.parse(row.preferredDays) as unknown,
    location: row.location,
    equipment: JSON.parse(row.equipment) as unknown,
  });
}

export function createSequelizeProfileRepository(): ProfileRepository {
  return {
    async get(userId) {
      const row = await ProfileModel.findOne({ where: { userId } });
      return row ? toProfile(row) : null;
    },
    async upsert(userId, profile) {
      const values = {
        ...profile,
        preferredDays: JSON.stringify(profile.preferredDays),
        equipment: JSON.stringify(profile.equipment),
      };
      const existing = await ProfileModel.findOne({ where: { userId } });
      const row = existing
        ? await existing.update(values)
        : await ProfileModel.create({ userId, ...values });
      return toProfile(row);
    },
  };
}
