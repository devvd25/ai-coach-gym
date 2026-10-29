import {
  GOAL_LABELS,
  LEVEL_LABELS,
  MAX_SETS_PER_SESSION,
  type AiNutritionOutput,
  type AiPlanOutput,
  type AiReviewOutput,
  type AiChatOutput,
  type Day,
  type Exercise,
  type Profile,
  type WeekStats,
} from '@ai-coach/shared';
import { allowedExercises, MIN_SETS_PER_SESSION } from './safety-rules.js';
import { referenceTargets } from './nutrition-reference.js';

/* ---------- Workout plan template (fallback when the model fails twice) ---------- */

const DEFAULT_DAYS: Record<number, Day[]> = {
  2: ['mon', 'thu'],
  3: ['mon', 'wed', 'fri'],
  4: ['mon', 'tue', 'thu', 'fri'],
  5: ['mon', 'tue', 'wed', 'fri', 'sat'],
  6: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
};

/** Each slot lists exercises in order of preference; the first one the user may do is used. */
const SESSION_TYPES: Record<string, { title: string; slots: string[][] }> = {
  fullA: {
    title: 'Toàn thân A',
    slots: [
      ['squat', 'goblet-squat', 'leg-press', 'bodyweight-squat', 'glute-bridge'],
      ['bench-press', 'incline-dumbbell-press', 'chest-fly-machine', 'push-up'],
      [
        'barbell-row',
        'one-arm-dumbbell-row',
        'seated-cable-row',
        'lat-pulldown',
        'band-pull-apart',
      ],
      ['dumbbell-shoulder-press', 'overhead-press', 'lateral-raise', 'face-pull'],
      ['dead-bug', 'plank', 'side-plank'],
    ],
  },
  fullB: {
    title: 'Toàn thân B',
    slots: [
      ['romanian-deadlift', 'hip-thrust', 'leg-curl', 'glute-bridge'],
      ['lat-pulldown', 'pull-up', 'one-arm-dumbbell-row', 'band-pull-apart'],
      ['incline-dumbbell-press', 'bench-press', 'chest-fly-machine', 'push-up'],
      ['leg-press', 'goblet-squat', 'walking-lunge', 'bodyweight-squat'],
      ['dead-bug', 'russian-twist', 'plank'],
    ],
  },
  upper: {
    title: 'Thân trên',
    slots: [
      ['bench-press', 'incline-dumbbell-press', 'chest-fly-machine', 'push-up'],
      ['barbell-row', 'seated-cable-row', 'one-arm-dumbbell-row', 'band-pull-apart'],
      ['dumbbell-shoulder-press', 'overhead-press', 'lateral-raise'],
      ['lat-pulldown', 'pull-up', 'face-pull'],
      ['hammer-curl', 'barbell-curl'],
      ['triceps-pushdown', 'overhead-triceps-extension'],
    ],
  },
  lower: {
    title: 'Thân dưới',
    slots: [
      ['squat', 'goblet-squat', 'leg-press', 'bodyweight-squat'],
      ['romanian-deadlift', 'hip-thrust', 'glute-bridge'],
      ['leg-press', 'walking-lunge', 'leg-extension', 'bodyweight-squat'],
      ['leg-curl', 'glute-bridge'],
      ['calf-raise'],
      ['dead-bug', 'plank'],
    ],
  },
  push: {
    title: 'Đẩy (ngực, vai, tay sau)',
    slots: [
      ['bench-press', 'incline-dumbbell-press', 'push-up'],
      ['dumbbell-shoulder-press', 'overhead-press'],
      ['incline-dumbbell-press', 'chest-fly-machine', 'push-up'],
      ['lateral-raise'],
      ['triceps-pushdown', 'overhead-triceps-extension'],
    ],
  },
  pull: {
    title: 'Kéo (lưng, tay trước)',
    slots: [
      ['pull-up', 'lat-pulldown', 'band-pull-apart'],
      ['barbell-row', 'one-arm-dumbbell-row', 'seated-cable-row'],
      ['face-pull', 'band-pull-apart'],
      ['barbell-curl', 'hammer-curl'],
      ['hanging-knee-raise', 'dead-bug'],
    ],
  },
};

const SPLITS: Record<number, string[]> = {
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullA'],
  4: ['upper', 'lower', 'upper', 'lower'],
  5: ['push', 'pull', 'lower', 'upper', 'lower'],
  6: ['push', 'pull', 'lower', 'push', 'pull', 'lower'],
};

function pickDays(profile: Profile): Day[] {
  const n = profile.sessionsPerWeek;
  if (profile.preferredDays.length >= n) {
    const order = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
    return order.filter((d) => profile.preferredDays.includes(d)).slice(0, n);
  }
  return DEFAULT_DAYS[n] ?? DEFAULT_DAYS[3]!;
}

export function templatePlan(profile: Profile, library: readonly Exercise[]): AiPlanOutput {
  const allowed = new Map(allowedExercises(profile, library).map((e) => [e.slug, e]));
  const days = pickDays(profile);
  const split = SPLITS[profile.sessionsPerWeek] ?? SPLITS[3]!;

  const sessions = days.map((day, i) => {
    const type = SESSION_TYPES[split[i % split.length]!]!;
    const used = new Set<string>();
    const picked: Exercise[] = [];
    for (const slot of type.slots) {
      const ex = slot.map((s) => allowed.get(s)).find((e) => e && !used.has(e.slug));
      if (ex) {
        used.add(ex.slug);
        picked.push(ex);
      }
    }
    // Rare (e.g. bodyweight only with several injuries): top up with any remaining allowed exercise.
    for (const ex of allowed.values()) {
      if (picked.length >= 4) break;
      if (!used.has(ex.slug)) {
        used.add(ex.slug);
        picked.push(ex);
      }
    }
    const exercises = picked.map((e, idx) => ({
      slug: e.slug,
      sets: Math.min(4, Math.max(2, idx < 2 ? e.defaultSets : 3)),
      reps: e.defaultReps,
      restSeconds: Math.min(240, Math.max(30, e.restSeconds)),
    }));
    let total = exercises.reduce((n, e) => n + e.sets, 0);
    for (let k = exercises.length - 1; total > MAX_SETS_PER_SESSION && k >= 0; k--) {
      while (exercises[k]!.sets > 2 && total > MAX_SETS_PER_SESSION) {
        exercises[k]!.sets--;
        total--;
      }
    }
    for (let k = 0; total < MIN_SETS_PER_SESSION && k < exercises.length; k++) {
      while (exercises[k]!.sets < 4 && total < MIN_SETS_PER_SESSION) {
        exercises[k]!.sets++;
        total++;
      }
    }
    return { day, title: type.title, durationMin: profile.sessionMinutes, exercises };
  });

  return {
    summary:
      `Kế hoạch mẫu cho mục tiêu ${GOAL_LABELS[profile.goal].title.toLowerCase()}, trình độ ` +
      `${LEVEL_LABELS[profile.level].toLowerCase()}, ${profile.sessionsPerWeek} buổi/tuần. ` +
      'Mỗi buổi ưu tiên bài compound trước, chỉ dùng dụng cụ bạn có và đã loại các bài gây áp lực lên chấn thương đã khai báo.',
    sessions,
  };
}

/* ---------- Nutrition template ---------- */

/** Meal times and calorie share, used by the template and given to the model as a guide. */
export const MEAL_SPLIT = [
  { name: 'Bữa sáng', time: '07:00', share: 0.25 },
  { name: 'Bữa trưa', time: '12:00', share: 0.35 },
  { name: 'Bữa phụ', time: '16:00', share: 0.15 },
  { name: 'Bữa tối', time: '19:00', share: 0.25 },
] as const;

const DISHES: Record<Profile['goal'], [string, string, string, string]> = {
  fat_loss: [
    'Yến mạch nấu sữa không đường, 1 quả trứng luộc',
    'Cơm gạo lứt, ức gà luộc, rau cải luộc',
    'Sữa chua không đường, 1 quả táo',
    'Cá hấp, đậu phụ, salad rau xanh',
  ],
  muscle_gain: [
    'Phở bò ít bánh, 2 quả trứng luộc',
    'Cơm trắng, thịt bò xào, rau muống luộc',
    'Sữa chua Hy Lạp, chuối, 30 g hạt điều',
    'Cá hồi áp chảo, khoai lang, salad dầu ô liu',
  ],
  maintain: [
    'Bánh mì trứng ốp la, 1 ly sữa',
    'Cơm, thịt heo nạc kho, canh rau ngót',
    'Sữa chua, 1 quả chuối',
    'Cá kho, đậu phụ sốt cà chua, rau luộc',
  ],
};

export function templateNutrition(profile: Profile): AiNutritionOutput {
  const targets = referenceTargets(profile);
  const meals = MEAL_SPLIT.map((m, i) => ({
    name: m.name,
    time: m.time,
    dish: DISHES[profile.goal][i]!,
    kcal: Math.round(targets.kcal * m.share),
    proteinG: Math.round(targets.proteinG * m.share),
    carbG: Math.round(targets.carbG * m.share),
    fatG: Math.round(targets.fatG * m.share),
  }));
  return {
    targets,
    meals,
    explanation:
      `Mức ${targets.kcal.toLocaleString('vi-VN')} kcal tính theo công thức Mifflin–St Jeor với ` +
      `${profile.sessionsPerWeek} buổi tập/tuần cho mục tiêu ${GOAL_LABELS[profile.goal].title.toLowerCase()}. ` +
      `Protein ${targets.proteinG} g (khoảng ${(targets.proteinG / profile.weightKg).toFixed(1).replace('.', ',')} g/kg), chia 4 bữa với món Việt dễ mua.`,
  };
}

/* ---------- Weekly review and chat fallbacks ---------- */

const fmt = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export function templateReview(stats: WeekStats): AiReviewOutput {
  if (stats.plannedSessions === 0 && stats.workouts === 0) {
    return {
      verdict:
        'Tuần này chưa có lịch tập và chưa ghi buổi tập nào nên chưa đủ dữ liệu để nhận xét.',
      highlights: ['Chưa có dữ liệu tập luyện trong tuần.'],
      nextSteps: ['Tạo lịch tập cho tuần tới và ghi lại từng buổi sau khi tập.'],
    };
  }
  const pct = stats.completionPct;
  const highlights: string[] = [];
  if (pct !== null) {
    highlights.push(
      `Hoàn thành ${stats.completedSessions}/${stats.plannedSessions} buổi theo kế hoạch (${pct}%).`,
    );
  }
  highlights.push(
    `Tổng khối lượng ${fmt(stats.volumeKg)} kg qua ${stats.totalSets} set (tuần trước ${fmt(stats.previousVolumeKg)} kg).`,
  );
  if (stats.avgRpe !== null) highlights.push(`RPE trung bình ${fmt(stats.avgRpe)}.`);
  if (stats.weightStartKg !== null && stats.weightEndKg !== null) {
    const d = stats.weightEndKg - stats.weightStartKg;
    highlights.push(
      `Cân nặng ${d === 0 ? 'giữ nguyên' : `${d > 0 ? 'tăng' : 'giảm'} ${fmt(Math.abs(d))} kg`} trong tuần.`,
    );
  }
  const nextSteps: string[] = [];
  if (pct !== null && pct < 80)
    nextSteps.push(
      'Ưu tiên hoàn thành đủ số buổi; nếu bận, giảm số buổi trong hồ sơ cho thực tế hơn.',
    );
  if (stats.avgRpe !== null && stats.avgRpe >= 9)
    nextSteps.push('RPE cao: giảm nhẹ mức tạ hoặc thêm một ngày nghỉ để hồi phục.');
  if (nextSteps.length === 0)
    nextSteps.push('Giữ nhịp tập và tăng nhẹ mức tạ hoặc số rep ở các bài chính.');
  const trend =
    stats.volumeKg > stats.previousVolumeKg
      ? 'tăng'
      : stats.volumeKg < stats.previousVolumeKg
        ? 'giảm'
        : 'không đổi';
  return {
    verdict:
      (pct === null
        ? `Tuần này bạn đã ghi ${stats.workouts} buổi tập.`
        : `Bạn hoàn thành ${pct}% kế hoạch tuần.`) + ` Khối lượng tập ${trend} so với tuần trước.`,
    highlights: highlights.slice(0, 4),
    nextSteps: nextSteps.slice(0, 3),
  };
}

export const CHAT_FALLBACK: AiChatOutput = {
  answer:
    'Xin lỗi, AI Coach chưa trả lời được câu này. Bạn thử hỏi lại ngắn gọn hơn, hoặc xem hướng dẫn kỹ thuật trong Thư viện bài tập.',
  suggestions: ['Tuần này tôi nên tập gì?', 'Tôi nên ăn bao nhiêu protein?'],
};
