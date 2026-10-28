import { fieldErrors, loginSchema } from '@ai-coach/shared';
import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { FormAlert, TextField } from '../../components/form.js';
import { AuthHeading, AuthLayout } from '../../layouts/AuthLayout.js';
import { ApiError } from '../../lib/api.js';
import { useAuth } from './AuthProvider.js';
import { nextStep } from './next-step.js';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const from = (useLocation().state as { from?: string } | null)?.from;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const user = await login(parsed.data);
      navigate(nextStep(user) ?? from ?? '/', { replace: true });
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra, vui lòng thử lại');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <form className="auth-form" onSubmit={onSubmit} noValidate>
        <AuthHeading title="Đăng nhập" lead="Chào mừng quay lại. Tiếp tục kế hoạch tập của bạn." />
        <FormAlert message={alert} />
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="ban@email.com"
          value={email}
          onChange={setEmail}
          error={errors.email}
        />
        <TextField
          label="Mật khẩu"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="auth-divider">hoặc</p>
        <Link to="/dang-ky" className="btn btn-secondary btn-block auth-link-btn">
          Tạo tài khoản mới
        </Link>
      </form>
    </AuthLayout>
  );
}
