import { z } from 'zod';

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Email không hợp lệ' }));

// bcrypt only uses the first 72 bytes, so longer passwords are rejected instead of silently cut.
export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(72, 'Mật khẩu tối đa 72 ký tự')
  .regex(/[a-z]/, 'Mật khẩu cần có chữ thường')
  .regex(/[A-Z]/, 'Mật khẩu cần có chữ hoa')
  .regex(/\d/, 'Mật khẩu cần có chữ số');

export const registerSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Nhập họ và tên (tối thiểu 2 ký tự)')
    .max(120, 'Họ và tên tối đa 120 ký tự'),
  email: emailSchema,
  password: passwordSchema,
  acceptTerms: z.literal(true, { error: 'Bạn cần đồng ý với điều khoản để tiếp tục' }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Nhập mật khẩu'),
});

/** Profile data and training logs are required to use the app; camera and research are opt-in. */
export const consentSchema = z.object({
  profileData: z.literal(true, { error: 'Cần đồng ý xử lý hồ sơ để tạo kế hoạch' }),
  trainingLogs: z.literal(true, { error: 'Cần đồng ý lưu nhật ký tập luyện' }),
  camera: z.boolean(),
  research: z.boolean(),
});

export const userSchema = z.object({
  id: z.number().int(),
  email: z.string(),
  fullName: z.string(),
  healthConsentAt: z.iso.datetime({ offset: true }).nullable(),
  consents: z.object({ camera: z.boolean(), research: z.boolean() }),
  hasProfile: z.boolean(),
});

export const authResponseSchema = z.object({
  token: z.string(),
  expiresAt: z.iso.datetime(),
  user: userSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ConsentInput = z.infer<typeof consentSchema>;
export type User = z.infer<typeof userSchema>;
export type AuthResponse = z.infer<typeof authResponseSchema>;

/** 0–4 score for the strength meter: one point per satisfied rule beyond the minimum length. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (password.length < 8) return 0;
  const rules = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/];
  const met = rules.filter((r) => r.test(password)).length;
  return Math.max(1, met) as 1 | 2 | 3 | 4;
}
