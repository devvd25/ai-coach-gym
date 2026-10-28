import { Link, Route, Routes } from 'react-router';
import { ConsentPage } from './features/auth/ConsentPage.js';
import { PublicOnly, RequireAuth, RequireReady, SetupStep } from './features/auth/guards.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { RegisterPage } from './features/auth/RegisterPage.js';
import { DashboardPage } from './features/dashboard/DashboardPage.js';
import { HealthPage } from './features/health/HealthPage.js';
import { ComingSoonPage } from './features/placeholder/ComingSoonPage.js';
import { OnboardingPage } from './features/profile/OnboardingPage.js';
import { ProfilePage } from './features/profile/ProfilePage.js';
import { AppLayout } from './layouts/AppLayout.js';

const SOON = [
  ['lich-tap', 'Lịch tập', 'M2 – M3', 'Lịch tập theo tuần, sửa buổi tập và đánh dấu hoàn thành.'],
  [
    'thu-vien',
    'Thư viện bài tập',
    'M2',
    'Khoảng 40 bài tập với nhóm cơ, dụng cụ, độ khó và hướng dẫn.',
  ],
  ['camera', 'Camera Squat', 'M4', 'Đếm rep Squat bằng MediaPipe ngay trên trình duyệt.'],
  ['nhat-ky', 'Nhật ký', 'M2', 'Ghi set, rep, khối lượng, RPE và cân nặng theo ngày.'],
  ['dinh-duong', 'Dinh dưỡng', 'M3', 'AI tính calo, macro và gợi ý thực đơn mỗi ngày.'],
  ['ai-coach', 'AI Coach', 'M3', 'Hỏi đáp và giải thích kế hoạch bằng LLM chạy local.'],
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
