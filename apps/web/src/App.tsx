import { Link, Route, Routes } from 'react-router';
import { HealthPage } from './features/health/HealthPage.js';

function NotFoundPage() {
  return (
    <main className="health">
      <section className="card health-hero">
        <p className="caption health-caption">404</p>
        <h1>Không tìm thấy trang</h1>
        <p className="muted">
          <Link to="/" style={{ color: 'var(--color-primary)' }}>
            Về trang trạng thái hệ thống
          </Link>
        </p>
      </section>
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HealthPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
