import { z } from 'zod';

export const SEXES = ['male', 'female'] as const;
export const GOALS = ['fat_loss', 'muscle_gain', 'maintain'] as const;
export const LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const LOCATIONS = ['gym', 'home'] as const;
export const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
export const EQUIPMENT = [
  'barbell',
  'dumbbell',
  'machine',
  'pullup_bar',
  'band',
  'bodyweight',
] as const;
export const SESSION_MINUTES = [30, 45, 60, 75, 90] as const;

export const SEX_LABELS: Record<(typeof SEXES)[number], string> = { male: 'Nam', female: 'Nữ' };
export const GOAL_LABELS: Record<(typeof GOALS)[number], { title: string; hint: string }> = {
  fat_loss: { title: 'Giảm mỡ', hint: 'Thâm hụt calo vừa phải, kết hợp cardio.' },
  muscle_gain: { title: 'Tăng cơ', hint: 'Dư calo nhẹ, ưu tiên bài compound.' },
  maintain: { title: 'Duy trì sức khỏe', hint: 'Cân bằng sức mạnh, sức bền, linh hoạt.' },
};
export const LEVEL_LABELS: Record<(typeof LEVELS)[number], string> = {
  beginner: 'Mới bắt đầu',
  intermediate: 'Trung bình',
  advanced: 'Nâng cao',
};
export const LOCATION_LABELS: Record<(typeof LOCATIONS)[number], string> = {
  gym: 'Phòng gym',
  home: 'Tại nhà',
};
export const DAY_LABELS: Record<(typeof DAYS)[number], string> = {
  mon: 'T2',
  tue: 'T3',
  wed: 'T4',
  thu: 'T5',
  fri: 'T6',
  sat: 'T7',
  sun: 'CN',
};
export const EQUIPMENT_LABELS: Record<(typeof EQUIPMENT)[number], string> = {
  barbell: 'Tạ đòn',
  dumbbell: 'Tạ đơn',
  machine: 'Máy tập',
  pullup_bar: 'Xà đơn',
  band: 'Dây kháng lực',
  bodyweight: 'Không dụng cụ',
};

/** Field rules without cross-field checks, so forms can validate one step at a time with .pick(). */
export const profileFieldsSchema = z.object({
  goal: z.enum(GOALS, { error: 'Chọn mục tiêu' }),
  sex: z.enum(SEXES, { error: 'Chọn giới tính' }),
  age: z
    .number({ error: 'Nhập tuổi' })
    .int('Tuổi phải là số nguyên')
    .min(14, 'Tuổi từ 14 trở lên')
    .max(80, 'Tuổi tối đa 80'),
  heightCm: z.number({ error: 'Nhập chiều cao' }).min(120, 'Từ 120 cm').max(230, 'Tối đa 230 cm'),
  weightKg: z.number({ error: 'Nhập cân nặng' }).min(30, 'Từ 30 kg').max(250, 'Tối đa 250 kg'),
  level: z.enum(LEVELS, { error: 'Chọn trình độ' }),
  injuries: z.string().trim().max(500, 'Tối đa 500 ký tự'),
  sessionsPerWeek: z.number().int().min(2, 'Tối thiểu 2 buổi').max(6, 'Tối đa 6 buổi'),
  sessionMinutes: z
    .number()
    .refine((v) => (SESSION_MINUTES as readonly number[]).includes(v), 'Chọn thời lượng'),
  preferredDays: z.array(z.enum(DAYS)).max(7),
  location: z.enum(LOCATIONS, { error: 'Chọn nơi tập' }),
  equipment: z.array(z.enum(EQUIPMENT)).min(1, 'Chọn ít nhất 1 loại dụng cụ'),
});

export const profileSchema = profileFieldsSchema.superRefine((p, ctx) => {
  if (p.preferredDays.length > 0 && p.preferredDays.length < p.sessionsPerWeek) {
    ctx.addIssue({
      code: 'custom',
      path: ['preferredDays'],
      message: `Chọn ít nhất ${p.sessionsPerWeek} ngày hoặc bỏ trống để AI tự xếp`,
    });
  }
});

export type Profile = z.infer<typeof profileSchema>;
