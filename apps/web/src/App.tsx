import { Link, Route, Routes } from 'react-router';
import { ConsentPage } from './features/auth/ConsentPage.js';
import { PublicOnly, RequireAuth, RequireReady, SetupStep } from './features/auth/guards.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { CoachPage } from './features/ai/CoachPage.js';
import { NutritionPage } from './features/ai/NutritionPage.js';
import { HealthPage } from './features/health/HealthPage.js';
import { ComingSoonPage } from './features/placeholder/ComingSoonPage.js';
import { OnboardingPage } from './features/profile/OnboardingPage.js';
import { ProfilePage } from './features/profile/ProfilePage.js';
import { LibraryPage } from './features/training/LibraryPage.js';
import { LogPage } from './features/training/LogPage.js';
import { PlanPage } from './features/training/PlanPage.js';
import { WorkoutPage } from './features/training/WorkoutPage.js';
import { WorkoutSummaryPage } from './features/training/WorkoutSummaryPage.js';
import { AppLayout } from './layouts/AppLayout.js';

const SOON = [
  ['camera', 'Camera Squat', 'M4', 'Đếm rep Squat bằng MediaPipe ngay trên trình duyệt.'],
] as const;

function NotFoundPage() {
  return (
    <main className="health">
      <section className="card health-hero">
        <p className="caption health-caption">404</p>
        <h1>Không tìm thấy trang</h1>
        <p className="muted">
          <Link to="/" className="link">
            Về trang tổng quan
          </Link>
        </p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/dang-nhap" element={<LoginPage />} />
        <Route path="/dang-ky" element={<RegisterPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<SetupStep step="/dong-y" />}>
          <Route path="/dong-y" element={<ConsentPage />} />
        </Route>
        <Route element={<SetupStep step="/onboarding" />}>
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Route>
        <Route element={<RequireReady />}>
          <Route element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="lich-tap" element={<PlanPage />} />
            <Route path="buoi-tap/:sessionId" element={<WorkoutPage />} />
            <Route path="thu-vien" element={<LibraryPage />} />
            <Route path="thu-vien/:slug" element={<LibraryPage />} />
            <Route path="nhat-ky" element={<LogPage />} />
            <Route path="nhat-ky/:id" element={<WorkoutSummaryPage />} />
            <Route path="dinh-duong" element={<NutritionPage />} />
            <Route path="ai-coach" element={<CoachPage />} />
            {SOON.map(([path, title, milestone, description]) => (
              <Route
                key={path}
                path={path}
                element={
                  <ComingSoonPage title={title} milestone={milestone} description={description} />
                }
              />
            ))}
            <Route path="ho-so" element={<ProfilePage />} />
          </Route>
        </Route>
      </Route>

      <Route path="/trang-thai" element={<HealthPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
