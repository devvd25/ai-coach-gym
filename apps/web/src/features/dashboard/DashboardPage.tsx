import { DASHBOARD_WEEKS, type WeekStat } from '@ai-coach/shared';
import { Link, useSearchParams } from 'react-router';
import { PageHeader } from '../../layouts/AppLayout.js';
import { dayMonth, kg } from '../../lib/format.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useDashboard } from './api.js';
import { ChartCard, Columns, Trend, type Point } from './charts.js';
import './dashboard.css';

/** Same threshold as the RF experiment target: a week counts as "on plan" from 80%. */
const COMPLETION_TARGET = 80;

function greeting(hour: number) {
  if (hour < 11) return 'Chào buổi sáng';
  if (hour < 14) return 'Chào buổi trưa';
  if (hour < 18) return 'Chào buổi chiều';
  return 'Chào buổi tối';
}

const int = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
const weekPoints = (weeks: readonly WeekStat[], pick: (w: WeekStat) => number | null): Point[] =>
  weeks.map((w) => ({
    label: dayMonth(w.weekStart),
    name: `Tuần ${dayMonth(w.weekStart)}`,
    value: pick(w),
  }));

export function DashboardPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const weeks = DASHBOARD_WEEKS.find((w) => String(w) === params.get('tuan')) ?? 8;
  const dashboard = useDashboard(weeks);
  const now = new Date();
  const firstName = user?.fullName.trim().split(/\s+/).pop() ?? '';
  const d = dashboard.data;
  const current = d?.weeks.at(-1);
  const previous = d?.weeks.at(-2);
  const hasTraining = d?.weeks.some((w) => w.workouts > 0 || w.plannedSessions > 0) ?? false;

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
        actions={
          <div className="segmented" role="group" aria-label="Khoảng thời gian">
            {DASHBOARD_WEEKS.map((w) => (
              <button
                key={w}
                type="button"
                className="segmented-item"
                aria-pressed={w === weeks}
                onClick={() => setParams(w === 8 ? {} : { tuan: String(w) })}
              >
                {w} tuần
              </button>
            ))}
          </div>
        }
      />

      {dashboard.isPending && <p className="muted">Đang tải số liệu…</p>}
      {dashboard.isError && <p className="form-alert">Không tải được số liệu, vui lòng thử lại.</p>}

      {d && current && (
        <>
          <section className="kpis" aria-label="Tuần này">
            <Kpi
              label="Buổi tập tuần này"
              value={int(current.workouts)}
              delta={previous && delta(current.workouts - previous.workouts, int, 'buổi')}
            />
            <Kpi
              label="Khối lượng tuần này"
              value={kg(current.volumeKg)}
              delta={previous && delta(current.volumeKg - previous.volumeKg, int, 'kg')}
            />
            <Kpi
              label="Hoàn thành kế hoạch"
              value={current.completionPct === null ? '—' : `${current.completionPct}%`}
              note={
                current.plannedSessions
                  ? `${current.completedSessions}/${current.plannedSessions} buổi`
                  : 'Tuần này chưa có lịch'
              }
            />
            <Kpi
              label="Rep Squat tuần này"
              value={int(current.squatReps)}
              note={`${current.squatSessions} lần dùng camera`}
            />
          </section>

          {!hasTraining && (
            <section className="card card-accent stack">
              <p className="caption logo-accent">Bắt đầu</p>
              <h2>Chưa có dữ liệu tập luyện</h2>
              <p className="muted">
                Tạo lịch tuần bằng AI, ghi lại từng buổi tập và cân nặng; biểu đồ sẽ tự cập nhật.
              </p>
              <div className="row-actions">
                <Link to="/lich-tap" className="btn btn-primary">
                  Tạo lịch tập
                </Link>
                <Link to="/dinh-duong" className="btn btn-secondary">
                  Thực đơn hôm nay
                </Link>
              </div>
            </section>
          )}

          <div className="chart-grid">
            <ChartCard
              title="Tần suất tập"
              subtitle="Số buổi đã ghi mỗi tuần"
              data={weekPoints(d.weeks, (w) => w.workouts)}
              format={(v) => `${int(v)} buổi`}
            >
              <Columns
                data={weekPoints(d.weeks, (w) => w.workouts)}
                label="Buổi tập"
                format={(v) => `${int(v)} buổi`}
              />
            </ChartCard>

            <ChartCard
              title="Tổng khối lượng"
              subtitle="Tạ × rep của mọi set trong tuần (kg)"
              data={weekPoints(d.weeks, (w) => w.volumeKg)}
              format={kg}
            >
              <Columns
                data={weekPoints(d.weeks, (w) => w.volumeKg)}
                label="Khối lượng"
                format={kg}
              />
            </ChartCard>

            <ChartCard
              title="Tỉ lệ hoàn thành kế hoạch"
              subtitle={`Buổi hoàn thành / buổi trong lịch · mục tiêu ${COMPLETION_TARGET}%`}
              data={weekPoints(d.weeks, (w) => w.completionPct)}
              format={(v) => `${v}%`}
              empty={
                d.weeks.every((w) => w.completionPct === null)
                  ? 'Chưa có tuần nào có lịch tập.'
                  : undefined
              }
            >
              <Columns
                data={weekPoints(d.weeks, (w) => w.completionPct)}
                label="Hoàn thành"
                format={(v) => `${v}%`}
                domainMax={100}
                target={{ value: COMPLETION_TARGET, label: `${COMPLETION_TARGET}%` }}
              />
            </ChartCard>

            <ChartCard
              title="Xu hướng cân nặng"
              subtitle="Các lần cân trong khoảng đã chọn"
              data={d.weights.map((w) => ({
                label: dayMonth(w.date),
                name: dayMonth(w.date),
                value: w.weightKg,
              }))}
              format={kg}
              empty={
                d.weights.length === 0 ? 'Chưa ghi cân nặng. Thêm ở trang Nhật ký.' : undefined
              }
            >
              <Trend
                data={d.weights.map((w) => ({
                  label: dayMonth(w.date),
                  name: dayMonth(w.date),
                  value: w.weightKg,
                }))}
                label="Cân nặng"
                format={kg}
              />
            </ChartCard>

            <ChartCard
              title="Rep Squat theo thời gian"
              subtitle="Mỗi cột là một lần đếm bằng camera"
              data={d.squats.map(squatPoint)}
              format={(v) => `${int(v)} rep`}
              empty={
                d.squats.length === 0 ? 'Chưa có lần đếm Squat nào. Thử ở trang Camera.' : undefined
              }
            >
              <Columns
                data={d.squats.map(squatPoint)}
                label="Số rep"
                format={(v) => `${int(v)} rep`}
              />
            </ChartCard>
          </div>
        </>
      )}
    </>
  );
}

function squatPoint(s: {
  startedAt: string;
  repCount: number;
  avgMinKneeAngle: number | null;
}): Point {
  const t = new Date(s.startedAt);
  const time = t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  return {
    label: dayMonth(t),
    name: `${dayMonth(t)} ${time}${s.avgMinKneeAngle === null ? '' : ` · gối ${s.avgMinKneeAngle}°`}`,
    value: s.repCount,
  };
}

function delta(diff: number, format: (n: number) => string, unit: string): string {
  if (Math.round(diff) === 0) return 'Bằng tuần trước';
  return `${diff > 0 ? '+' : '−'}${format(Math.abs(diff))} ${unit} so với tuần trước`;
}

function Kpi({
  label,
  value,
  delta,
  note,
}: {
  label: string;
  value: string;
  delta?: string;
  note?: string;
}) {
  return (
    <div className="card kpi">
      <span className="caption">{label}</span>
      <span className="kpi-value">{value}</span>
      {(delta ?? note) && <span className="muted">{delta ?? note}</span>}
    </div>
  );
}
