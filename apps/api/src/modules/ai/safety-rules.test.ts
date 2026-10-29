import type { AiNutritionOutput, AiPlanOutput, Profile } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import { LIBRARY, PROFILE } from '../../test/library.js';
import { referenceTargets } from './nutrition-reference.js';
import { allowedExercises, checkNutrition, checkPlan, contraindicated } from './safety-rules.js';
import { templateNutrition, templatePlan } from './templates.js';

const session = (day: AiPlanOutput['sessions'][number]['day'], slugs: string[], sets = 3) => ({
  day,
  title: 'Buổi',
  durationMin: 60,
  exercises: slugs.map((slug) => ({ slug, sets, reps: '8-12', restSeconds: 90 })),
});

const goodPlan: AiPlanOutput = {
  summary: 'Upper/lower 4 buổi.',
  sessions: [
    session('mon', ['bench-press', 'barbell-row', 'lateral-raise']),
    session('tue', ['squat', 'romanian-deadlift', 'leg-curl']),
    session('thu', ['incline-dumbbell-press', 'lat-pulldown', 'hammer-curl']),
    session('fri', ['leg-press', 'hip-thrust', 'calf-raise']),
  ],
};

describe('injury and equipment filtering', () => {
  it('maps accent-insensitive injury text to exercises to avoid', () => {
    const blocked = contraindicated({ injuries: 'Đau GỐI trái khi xuống sâu' });
    expect(blocked.get('walking-lunge')).toBe('gối');
    expect(blocked.has('bench-press')).toBe(false);
    expect(contraindicated({ injuries: '' }).size).toBe(0);
  });

  it('keeps only exercises the user can do', () => {
    const home: Profile = { ...PROFILE, level: 'beginner', equipment: ['dumbbell', 'bodyweight'] };
    const slugs = allowedExercises(home, LIBRARY).map((e) => e.slug);
    expect(slugs).toContain('goblet-squat');
    expect(slugs).toContain('push-up');
    expect(slugs).not.toContain('squat'); // barbell
    expect(slugs).not.toContain('bulgarian-split-squat'); // advanced
  });
});

describe('checkPlan', () => {
  it('accepts a plan that follows the rules', () => {
    expect(checkPlan(goodPlan, PROFILE, LIBRARY)).toEqual([]);
  });

  it('reports wrong session count, duplicate days and too many sets', () => {
    const bad: AiPlanOutput = {
      summary: '',
      sessions: [
        session('mon', ['bench-press', 'barbell-row', 'squat', 'leg-press', 'lat-pulldown'], 5),
        session('mon', ['squat', 'leg-curl']),
        { ...session('tue', ['leg-press', 'leg-curl']), title: 'Ngày nghỉ' },
      ],
    };
    const v = checkPlan(bad, PROFILE, LIBRARY).join('\n');
    expect(v).toContain('Cần đúng 4 buổi');
    expect(v).toContain('không được là ngày nghỉ');
    expect(v).toContain('Mỗi ngày chỉ được có 1 buổi');
    expect(v).toContain('25 set, vượt giới hạn 20');
  });

  it('reports exercises that conflict with an injury or are unknown', () => {
    const knee: Profile = { ...PROFILE, injuries: 'đau gối' };
    const plan: AiPlanOutput = {
      ...goodPlan,
      sessions: [
        session('mon', ['walking-lunge', 'bench-press', 'made-up']),
        ...goodPlan.sessions.slice(1),
      ],
    };
    const v = checkPlan(plan, knee, LIBRARY).join('\n');
    expect(v).toContain('gây áp lực lên gối');
    expect(v).toContain('"made-up" không có trong thư viện');
  });

  it('reports unsafe reps, rest and days outside the chosen ones', () => {
    const plan: AiPlanOutput = {
      ...goodPlan,
      sessions: goodPlan.sessions.map((s, i) =>
        i === 0
          ? { ...s, exercises: s.exercises.map((e) => ({ ...e, reps: '50', restSeconds: 10 })) }
          : s,
      ),
    };
    const picky: Profile = { ...PROFILE, preferredDays: ['tue', 'wed', 'thu', 'fri'] };
    const v = checkPlan(plan, picky, LIBRARY).join('\n');
    expect(v).toContain('ngày không chọn: T2');
    expect(v).toContain('nằm ngoài khoảng an toàn');
    expect(v).toContain('nghỉ 10 giây');
  });
});

describe('checkNutrition', () => {
  const ref = referenceTargets(PROFILE);

  it('flags calories under the minimum and macros that do not add up', () => {
    const n: AiNutritionOutput = {
      targets: { kcal: 1100, proteinG: 40, carbG: 300, fatG: 20, waterL: 2.4 },
      meals: [
        { name: 'Sáng', time: '07:00', dish: 'Phở', kcal: 400, proteinG: 10, carbG: 60, fatG: 5 },
        { name: 'Trưa', time: '12:00', dish: 'Cơm', kcal: 400, proteinG: 10, carbG: 60, fatG: 5 },
        { name: 'Tối', time: '19:00', dish: 'Cá', kcal: 300, proteinG: 20, carbG: 30, fatG: 10 },
      ],
      explanation: '',
    };
    const v = checkNutrition(n, PROFILE).join('\n');
    expect(v).toContain('thấp hơn ngưỡng tối thiểu 1500');
    expect(v).toContain('lệch quá 20%');
    expect(v).toContain('Protein 40 g');
    expect(v).toContain('Chất béo 20 g quá thấp');
    expect(v).toContain('Macro cộng lại');
  });

  it('accepts the reference targets', () => {
    expect(ref.kcal).toBeGreaterThan(2000);
    expect(checkNutrition(templateNutrition(PROFILE), PROFILE)).toEqual([]);
  });
});

describe('templates always pass the safety rules', () => {
  const variants: Profile[] = [];
  for (const sessionsPerWeek of [2, 3, 4, 5, 6]) {
    for (const level of ['beginner', 'intermediate', 'advanced'] as const) {
      for (const equipment of [
        PROFILE.equipment,
        ['dumbbell', 'bodyweight'] as Profile['equipment'],
        ['bodyweight'] as Profile['equipment'],
      ]) {
        for (const injuries of ['', 'đau gối', 'thoát vị đĩa đệm lưng', 'đau vai, cổ tay']) {
          variants.push({ ...PROFILE, sessionsPerWeek, level, equipment, injuries });
        }
      }
    }
  }
  variants.push({ ...PROFILE, sessionsPerWeek: 3, preferredDays: ['tue', 'thu', 'sat'] });
  variants.push({
    ...PROFILE,
    sex: 'female',
    weightKg: 45,
    heightCm: 150,
    age: 60,
    goal: 'fat_loss',
  });

  it.each(variants.map((p, i) => [i, p] as const))('plan variant %i', (_i, profile) => {
    expect(checkPlan(templatePlan(profile, LIBRARY), profile, LIBRARY)).toEqual([]);
  });

  it.each(variants.map((p, i) => [i, p] as const))('nutrition variant %i', (_i, profile) => {
    expect(checkNutrition(templateNutrition(profile), profile)).toEqual([]);
  });
});
