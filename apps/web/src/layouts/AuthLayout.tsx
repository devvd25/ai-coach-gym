import type { ReactNode } from 'react';
import { Logo } from '../components/Logo.js';
import './auth.css';

const FEATURES = [
  [
    '01',
    'Kế hoạch cá nhân hóa bằng AI',
    'Lịch tập và thực đơn theo mục tiêu, trình độ và chấn thương của bạn.',
  ],
  [
    '02',
    'Đếm rep Squat bằng camera',
    'Nhận diện tư thế ngay trên trình duyệt, video không rời máy.',
  ],
  ['03', 'Tiến độ rõ ràng mỗi tuần', 'Khối lượng tập, cân nặng và tỉ lệ hoàn thành kế hoạch.'],
] as const;

/** Split screen from Figma 01a–01c: brand hero on the left (desktop only), form on the right. */
export function AuthLayout({ children, wide }: { children: ReactNode; wide?: boolean }) {
  return (
    <div className="auth">
      <section className="auth-hero" aria-hidden="true">
        <Logo />
        <div className="auth-hero-body">
          <p className="caption auth-kicker">Huấn luyện viên AI cho người tập gym</p>
          <p className="auth-headline">
            Tập đúng.
            <br />
            <span className="logo-accent">Tiến bộ thật.</span>
          </p>
          <p className="muted auth-lead">
            AI Coach lập lịch tập, gợi ý dinh dưỡng và đếm rep Squat qua camera — chạy hoàn toàn
            trên máy của bạn.
          </p>
          <ol className="auth-features">
            {FEATURES.map(([n, title, text]) => (
              <li key={n}>
                <span className="number auth-feature-num">{n}</span>
                <span>
                  <strong>{title}</strong>
                  <span className="muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
        <p className="muted">
          Dữ liệu sức khỏe chỉ dùng để cá nhân hóa kế hoạch của bạn, không chia sẻ cho bên thứ ba.
        </p>
      </section>
      <main className="auth-panel">
        <div className="auth-mobile-logo">
          <Logo />
        </div>
        <div className={`auth-form ${wide ? 'auth-form-wide' : ''}`}>{children}</div>
      </main>
    </div>
  );
}

export function AuthHeading({
  caption,
  title,
  lead,
}: {
  caption?: string;
  title: string;
  lead?: string;
}) {
  return (
    <div className="auth-heading">
      {caption && <p className="caption logo-accent">{caption}</p>}
      <h1>{title}</h1>
      {lead && <p className="muted">{lead}</p>}
    </div>
  );
}
