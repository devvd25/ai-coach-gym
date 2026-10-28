import { useQuery } from '@tanstack/react-query';
import { fetchHealth } from '../../api/health.js';
import { toServiceRows } from './health-view.js';
import './health.css';

export function HealthPage() {
  const query = useQuery({
    queryKey: ['health'],
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 10_000,
    retry: false,
  });
  const rows = toServiceRows(query.data, !query.isError);
  const allOk = rows.every((r) => r.ok);

  return (
    <main className="health">
      <header className="health-header">
        <div className="logo">
          <span className="logo-mark" aria-hidden="true">
            AC
          </span>
          <span className="logo-text">
            AI COACH <span className="logo-accent">GYM</span>
          </span>
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void query.refetch()}
          disabled={query.isFetching}
        >
          {query.isFetching ? 'Đang kiểm tra…' : 'Kiểm tra lại'}
        </button>
      </header>

      <section className="card health-hero">
        <p className="caption health-caption">M0 · Khung dự án</p>
        <h1>Trạng thái hệ thống</h1>
        <p className="muted">
          {query.isPending
            ? 'Đang kiểm tra kết nối…'
            : allOk
              ? 'Mọi thành phần đã sẵn sàng.'
              : 'Một vài thành phần chưa sẵn sàng. Xem hướng dẫn trong README.'}
        </p>
      </section>

      <ul className="health-list" aria-live="polite">
        {rows.map((row) => (
          <li key={row.key} className="card health-row">
            <div className="health-row-text">
              <h2>{row.label}</h2>
              <p className="muted">{row.detail}</p>
            </div>
            <span className="number health-latency">{row.latency}</span>
            <span className={`badge ${row.ok ? 'badge-solid' : 'badge-neutral'}`}>
              {row.ok ? 'Sẵn sàng' : 'Chưa sẵn sàng'}
            </span>
          </li>
        ))}
      </ul>

      {query.data && (
        <p className="muted">
          Cập nhật lúc {new Date(query.data.time).toLocaleTimeString('vi-VN')} · tự kiểm tra mỗi 10
          giây
        </p>
      )}
    </main>
  );
}
