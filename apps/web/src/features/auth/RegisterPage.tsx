import { fieldErrors, passwordStrength, registerSchema } from '@ai-coach/shared';
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Checkbox, FormAlert, TextField } from '../../components/form.js';
import { AuthHeading, AuthLayout } from '../../layouts/AuthLayout.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from './AuthProvider.js';
import { nextStep } from './next-step.js';

const STRENGTH = ['Quá ngắn', 'Yếu', 'Trung bình', 'Khá', 'Mạnh'] as const;

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', password: '', confirm: '' });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const strength = passwordStrength(form.password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    const parsed = registerSchema.safeParse({ ...form, acceptTerms });
    const next = parsed.success ? {} : fieldErrors(parsed.error);
    if (form.confirm !== form.password) next.confirm = 'Mật khẩu nhập lại không khớp';
    setErrors(next);
    if (!parsed.success || next.confirm) return;
    setBusy(true);
    try {
      const user = await register(parsed.data);
      navigate(nextStep(user) ?? '/', { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(err.fields);
        if (!Object.keys(err.fields).length) setAlert(err.message);
      } else setAlert('Đã có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <AuthHeading
          title="Tạo tài khoản"
          lead="Chưa đến 1 phút. Sau đó AI Coach hỏi vài thông tin để lập kế hoạch cho bạn."
        />
        <FormAlert message={alert} />
        <TextField
          label="Họ và tên"
          autoComplete="name"
          value={form.fullName}
          onChange={set('fullName')}
          error={errors.fullName}
        />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="new-password"
          value={form.password}
          onChange={set('password')}
          error={errors.password}
          hint="Tối thiểu 8 ký tự, có chữ hoa, chữ thường và chữ số"
        />
        {form.password && (
          <div className="stack" style={{ gap: 8 }}>
            <div className="strength" aria-hidden="true">
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className={i <= strength ? 'on' : ''} />
              ))}
            </div>
            <p className="field-hint">Độ mạnh: {STRENGTH[strength]}</p>
          </div>
        )}
        <TextField
          label="Nhập lại mật khẩu"
          type="password"
          autoComplete="new-password"
          value={form.confirm}
          onChange={set('confirm')}
          error={errors.confirm}
        />
        <Checkbox checked={acceptTerms} onChange={setAcceptTerms} error={errors.acceptTerms}>
          Tôi đồng ý với Điều khoản sử dụng và Chính sách quyền riêng tư.
        </Checkbox>
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Đang tạo tài khoản…' : 'Tạo tài khoản'}
        </button>
        <p className="auth-switch">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="link">
            Đăng nhập
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
