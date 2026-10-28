import { fieldErrors, profileFieldsSchema, profileSchema, type Profile } from '@ai-coach/shared';

/** Form state: numbers stay as typed text until submit, choices may still be unset. */
export interface ProfileDraft {
  goal?: Profile['goal'];
  sex?: Profile['sex'];
  age: string;
  heightCm: string;
  weightKg: string;
  level?: Profile['level'];
  injuries: string;
  sessionsPerWeek: number;
  sessionMinutes: number;
  preferredDays: Profile['preferredDays'];
  location: Profile['location'];
  equipment: Profile['equipment'];
}

export const emptyDraft: ProfileDraft = {
  age: '',
  heightCm: '',
  weightKg: '',
  injuries: '',
  sessionsPerWeek: 3,
  sessionMinutes: 60,
  preferredDays: [],
  location: 'gym',
  equipment: [],
};

export function draftFromProfile(p: Profile): ProfileDraft {
  return {
    ...p,
    age: String(p.age),
    heightCm: String(p.heightCm).replace('.', ','),
    weightKg: String(p.weightKg).replace('.', ','),
  };
}

/** Accepts Vietnamese decimal commas ("68,4"); blank stays undefined so Zod says "Nhập …". */
function toNumber(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  return t === '' ? undefined : Number(t);
}

export function draftToInput(d: ProfileDraft): Record<string, unknown> {
  return {
    ...d,
    age: toNumber(d.age),
    heightCm: toNumber(d.heightCm),
    weightKg: toNumber(d.weightKg),
  };
}

export const STEP_FIELDS = {
  body: ['goal', 'sex', 'age', 'heightCm', 'weightKg', 'level', 'injuries'],
  schedule: ['sessionsPerWeek', 'sessionMinutes', 'preferredDays', 'location', 'equipment'],
} as const;

const bodySchema = profileFieldsSchema.pick({
  goal: true,
  sex: true,
  age: true,
  heightCm: true,
  weightKg: true,
  level: true,
  injuries: true,
});

/** Errors for the first onboarding step only. */
export function validateBodyStep(d: ProfileDraft): Record<string, string> {
  const r = bodySchema.safeParse(draftToInput(d));
  return r.success ? {} : fieldErrors(r.error);
}

export function validateProfile(
  d: ProfileDraft,
): { ok: true; profile: Profile } | { ok: false; errors: Record<string, string> } {
  const r = profileSchema.safeParse(draftToInput(d));
  return r.success ? { ok: true, profile: r.data } : { ok: false, errors: fieldErrors(r.error) };
}

export function toggleIn<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
