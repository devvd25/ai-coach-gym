import { Navigate, Outlet, useLocation } from 'react-router';
import { useAuth } from './AuthProvider.js';
import { nextStep } from './next-step.js';

function FullPageLoader() {
  return (
    <div className="page-loader" role="status">
      <span className="logo-mark" aria-hidden="true">
        AC
      </span>
      <span className="muted">Đang tải…</span>
    </div>
  );
}

/** Login and register: signed-in users are sent on to the app (or their next setup step). */
export function PublicOnly() {
  const { session, user, loadingUser } = useAuth();
  if (!session) return <Outlet />;
  if (loadingUser || !user) return <FullPageLoader />;
  return <Navigate to={nextStep(user) ?? '/'} replace />;
}

export function RequireAuth() {
  const { session, user, loadingUser } = useAuth();
  const location = useLocation();
  if (!session) return <Navigate to="/dang-nhap" replace state={{ from: location.pathname }} />;
  if (loadingUser || !user) return <FullPageLoader />;
  return <Outlet />;
}

/** Wraps a setup step (consent, onboarding): only reachable while it is the user's next step. */
export function SetupStep({ step }: { step: '/dong-y' | '/onboarding' }) {
  const { user } = useAuth();
  const next = user ? nextStep(user) : null;
  if (next === step) return <Outlet />;
  return <Navigate to={next ?? '/'} replace />;
}

/** The main app: consent given and profile created. */
export function RequireReady() {
  const { user } = useAuth();
  const next = user ? nextStep(user) : null;
  return next ? <Navigate to={next} replace /> : <Outlet />;
}
