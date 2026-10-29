import {
  DAY_LABELS,
  macroKcal,
  MAX_SETS_PER_SESSION,
  normalizeSearch,
  repsSchema,
  type AiNutritionOutput,
  type AiPlanOutput,
  type Exercise,
  type Profile,
} from '@ai-coach/shared';
import { MIN_KCAL, PROTEIN_RANGE_PER_KG, referenceTargets } from './nutrition-reference.js';

export const MIN_SETS_PER_SESSION = 6;

/**
 * Keyword → exercises that load that body part. A heuristic for the research prototype, not a
 * medical rule: it only removes risky options, it never tells the user they are fine.
 */
const INJURY_RULES: { keywords: string[]; label: string; avoid: string[] }[] = [
  {
    keywords: ['goi', 'dau goi', 'sun goi', 'day chang'],
    label: 'gối',
    avoid: [
      'squat',
      'walking-lunge',
      'bulgarian-split-squat',
      'front-squat',
      'burpee',
      'leg-extension',
    ],
  },
  {
    keywords: ['lung', 'cot song', 'thoat vi', 'that lung'],
    label: 'lưng',
    avoid: [
      'deadlift',
      'barbell-row',
      'romanian-deadlift',
      'squat',
      'front-squat',
      'russian-twist',
    ],
  },
  {
    keywords: ['vai', 'khop vai', 'xoay vai'],
    label: 'vai',
    avoid: ['overhead-press', 'dips', 'bench-press', 'pull-up', 'dumbbell-shoulder-press'],
  },
  {
    keywords: ['co tay', 'khuyu tay', 'khuyu'],
    label: 'cổ tay/khuỷu tay',
    avoid: ['push-up', 'burpee', 'mountain-climber', 'front-squat', 'dips', 'plank', 'side-plank'],
  },
];

/** Slugs to keep away from this user because of what they wrote under injuries. */
export function contraindicated(profile: Pick<Profile, 'injuries'>): Map<string, string> {
  const text = normalizeSearch(profile.injuries);
  const out = new Map<string, string>();
  if (!text) return out;
  for (const rule of INJURY_RULES) {
    if (rule.keywords.some((k) => text.includes(k))) {
      for (const slug of rule.avoid) out.set(slug, rule.label);
    }
  }
  return out;
}

/** Exercises the user can do with their equipment, level and injuries. */
export function allowedExercises(profile: Profile, library: readonly Exercise[]): Exercise[] {
  const blocked = contraindicated(profile);
  return library.filter(
    (e) =>
      (e.equipment === 'bodyweight' || profile.equipment.includes(e.equipment)) &&
      !(profile.level === 'beginner' && e.level === 'advanced') &&
      !blocked.has(e.slug),
  );
}

function repCount(reps: string): { value: number; timed: boolean } {
  return { value: Number.parseInt(reps, 10), timed: reps.endsWith('s') };
}

export function checkPlan(
  plan: AiPlanOutput,
  profile: Profile,
  library: readonly Exercise[],
): string[] {
  const v: string[] = [];
  const bySlug = new Map(library.map((e) => [e.slug, e]));
  const allowed = new Set(allowedExercises(profile, library).map((e) => e.slug));
  const blocked = contraindicated(profile);

  if (plan.sessions.length !== profile.sessionsPerWeek) {
    v.push(
      `Cần đúng ${profile.sessionsPerWeek} buổi/tuần, kế hoạch có ${plan.sessions.length} buổi`,
    );
  }
  const days = plan.sessions.map((s) => s.day);
  if (new Set(days).size !== days.length) v.push('Mỗi ngày chỉ được có 1 buổi tập');
  if (profile.preferredDays.length > 0) {
    const off = days.filter((d) => !profile.preferredDays.includes(d));
    if (off.length)
      v.push(`Có buổi vào ngày không chọn: ${off.map((d) => DAY_LABELS[d]).join(', ')}`);
  }

  for (const s of plan.sessions) {
    const name = `${DAY_LABELS[s.day]} (${s.title})`;
    const sets = s.exercises.reduce((n, e) => n + e.sets, 0);
    // Small models sometimes fill the session count with a "rest day" that still lists exercises.
    if (/\bnghi\b/.test(normalizeSearch(s.title)))
      v.push(`${name}: buổi tập không được là ngày nghỉ`);
    if (sets > MAX_SETS_PER_SESSION)
      v.push(`${name}: ${sets} set, vượt giới hạn ${MAX_SETS_PER_SESSION} set/buổi`);
    if (sets < MIN_SETS_PER_SESSION)
      v.push(`${name}: chỉ ${sets} set, cần tối thiểu ${MIN_SETS_PER_SESSION}`);
    if (Math.abs(s.durationMin - profile.sessionMinutes) > 15) {
      v.push(
        `${name}: ${s.durationMin} phút, lệch quá 15 phút so với ${profile.sessionMinutes} phút đã chọn`,
      );
    }
    const slugs = s.exercises.map((e) => e.slug);
    if (new Set(slugs).size !== slugs.length) v.push(`${name}: có bài bị lặp`);
    for (const e of s.exercises) {
      const ex = bySlug.get(e.slug);
      if (!ex) {
        v.push(`${name}: bài "${e.slug}" không có trong thư viện`);
        continue;
      }
      if (blocked.has(e.slug))
        v.push(
          `${name}: ${ex.name} gây áp lực lên ${blocked.get(e.slug)} (chấn thương đã khai báo)`,
        );
      else if (!allowed.has(e.slug)) v.push(`${name}: ${ex.name} không hợp dụng cụ hoặc trình độ`);
      if (!repsSchema.safeParse(e.reps).success) {
        v.push(`${name}: rep "${e.reps}" sai định dạng (ví dụ 8, 8-12, 45s)`);
      } else {
        const r = repCount(e.reps);
        if (r.timed ? r.value < 15 || r.value > 120 : r.value < 3 || r.value > 30) {
          v.push(`${name}: ${ex.name} ${e.reps} nằm ngoài khoảng an toàn`);
        }
      }
      if (e.sets > 6) v.push(`${name}: ${ex.name} ${e.sets} set là quá nhiều (tối đa 6)`);
      if (e.restSeconds < 30 || e.restSeconds > 240)
        v.push(`${name}: nghỉ ${e.restSeconds} giây nằm ngoài 30–240 giây`);
    }
  }
  return v;
}

export function checkNutrition(n: AiNutritionOutput, profile: Profile): string[] {
  const v: string[] = [];
  const ref = referenceTargets(profile);
  const t = n.targets;
  if (t.kcal < MIN_KCAL[profile.sex])
    v.push(`Calo ${t.kcal} thấp hơn ngưỡng tối thiểu ${MIN_KCAL[profile.sex]} kcal`);
  if (Math.abs(t.kcal - ref.kcal) > ref.kcal * 0.2) {
    v.push(`Calo ${t.kcal} lệch quá 20% so với mức tham chiếu ${ref.kcal} kcal`);
  }
  const perKg = t.proteinG / profile.weightKg;
  if (perKg < PROTEIN_RANGE_PER_KG[0] || perKg > PROTEIN_RANGE_PER_KG[1]) {
    v.push(
      `Protein ${t.proteinG} g (${perKg.toFixed(1)} g/kg) ngoài khoảng ${PROTEIN_RANGE_PER_KG[0]}–${PROTEIN_RANGE_PER_KG[1]} g/kg`,
    );
  }
  if (t.fatG < profile.weightKg * 0.5) v.push(`Chất béo ${t.fatG} g quá thấp (tối thiểu 0,5 g/kg)`);
  const fromMacros = macroKcal(t);
  if (Math.abs(fromMacros - t.kcal) > t.kcal * 0.1) {
    v.push(`Macro cộng lại ${fromMacros} kcal không khớp mục tiêu ${t.kcal} kcal (±10%)`);
  }
  const meals = n.meals.reduce((s, m) => s + m.kcal, 0);
  if (Math.abs(meals - t.kcal) > t.kcal * 0.15)
    v.push(`Tổng các bữa ${meals} kcal lệch quá 15% so với ${t.kcal} kcal`);
  return v;
}
