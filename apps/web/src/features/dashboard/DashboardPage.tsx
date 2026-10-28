import { GOAL_LABELS, LEVEL_LABELS, LOCATION_LABELS } from '@ai-coach/shared';
import { Link } from 'react-router';
import { PageHeader } from '../../layouts/AppLayout.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useProfile } from '../profile/api.js';

function greeting(hour: number) {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

export function DashboardPage() {
  const { user } = useAuth();
  const profile = useProfile();
  const now = new Date();
  const firstName = user?.fullName.trim().split(/\s+/).pop() ?? '';
  const p = profile.data;

  return (
    <>
      <PageHeader
        caption={now.toLocaleDateString('vi-VN', {
          weekday: 'long',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        })}
        title={`${greeting(now.getHours())}, ${firstName}`}
      />
      <section className="card card-accent stack">
        <p className="caption logo-accent">Hồ sơ đã sẵn sàng</p>
        <h2>AI Coach sẽ lập kế hoạch tuần đầu tiên cho bạn</h2>
        <p className="muted">
          Tính năng sinh lịch tập và thực đơn bằng AI có ở mốc M3. Trong lúc chờ, bạn có thể kiểm
          tra lại hồ sơ.
        </p>
        {p && (
          <div className="row">
            <Mini label="Mục tiêu" value={GOAL_LABELS[p.goal].title} />
            <Mini label="Trình độ" value={LEVEL_LABELS[p.level]} />
            <Mini label="Lịch" value={`${p.sessionsPerWeek} buổi · ${p.sessionMinutes} phút`} />
            <Mini label="Nơi tập" value={LOCATION_LABELS[p.location]} />
          </div>
        )}
        <div>
          <Link to="/ho-so" className="btn btn-secondary">
            Xem hồ sơ
          </Link>
        </div>
      </section>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="mini">
      <span className="caption">{label}</span>
      <span className="number">{value}</span>
    </div>
  );
}
