import { ProfileModel } from '../profile/profile.model.js';
import { UserModel } from './user.model.js';

export interface UserRecord {
  id: number;
  email: string;
  passwordHash: string;
  fullName: string;
  healthConsentAt: Date | null;
  consentCamera: boolean;
  consentResearch: boolean;
  hasProfile: boolean;
}

export interface UserRepository {
  findByEmail(email: string): Promise<UserRecord | null>;
  findById(id: number): Promise<UserRecord | null>;
  create(input: { email: string; passwordHash: string; fullName: string }): Promise<UserRecord>;
  setConsent(id: number, consent: { camera: boolean; research: boolean }, at: Date): Promise<void>;
}

async function toRecord(row: UserModel): Promise<UserRecord> {
  const profiles = await ProfileModel.count({ where: { userId: row.id } });
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.passwordHash,
    fullName: row.fullName,
    healthConsentAt: row.healthConsentAt ?? null,
    consentCamera: Boolean(row.consentCamera),
    consentResearch: Boolean(row.consentResearch),
    hasProfile: profiles > 0,
  };
}

export function createSequelizeUserRepository(): UserRepository {
  return {
    async findByEmail(email) {
      const row = await UserModel.findOne({ where: { email } });
      return row ? toRecord(row) : null;
    },
    async findById(id) {
      const row = await UserModel.findByPk(id);
      return row ? toRecord(row) : null;
    },
    async create(input) {
      return toRecord(await UserModel.create(input));
    },
    async setConsent(id, consent, at) {
      await UserModel.update(
        { healthConsentAt: at, consentCamera: consent.camera, consentResearch: consent.research },
        { where: { id } },
      );
    },
  };
}
