import { FEELING_LABELS, volumeKg, type Workout } from '@ai-coach/shared';
import { Link, useLocation, useParams } from 'react-router';
import { PageHeader } from '../../layouts/AppLayout.js';
import { useAuth } from '../auth/AuthProvider.js';
import { useWorkout } from './api.js';
import { Metric } from './WorkoutPage.js';
import './training.css';

import { kg } from '../../lib/format.js';

/** Groups logged sets per exercise in the order they were first done. */
function byExercise(w: Workout) {
  const groups = new Map<number, { name: string; sets: Workout['sets'] }>();
  for (const s of w.sets) {
    const g = groups.get(s.exerciseId) ?? { name: s.exerciseName, sets: [] };
    g.sets.push(s);
    groups.set(s.exerciseId, g);
  }
  return [...groups.values()];
}

export function WorkoutSummaryPage() {
  const id = Number(useParams().id);
  const justFinished = (useLocation().state as { justFinished?: boolean } | null)?.justFinished;
  const { user } = useAuth();
  const workout = useWorkout(id);

  if (workout.isPending) return <p className="muted">Đang tải…</p>;
  if (workout.isError) {
    return (
      <div className="empty">
        Không tìm thấy buổi tập.{' '}
        <Link to="/nhat-ky" className="link">
          Về nhật ký
        </Link>
      </div>
    );
  }
  const w = workout.data;
  const date = new Date(w.startedAt);
  const firstName = user?.fullName.trim().split(/\s+/).pop();

  return (
    <>
      <PageHeader
        caption={`${w.title} · ${date.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })}`}
        title={justFinished ? 'Hoàn thành buổi tập' : 'Chi tiết buổi tập'}
        actions={
          <>
            <Link to="/nhat-ky" className="btn btn-secondary">
              Xem nhật ký
            </Link>
            <Link to="/" className="btn btn-primary">
              Về tổng quan
            </Link>
          </>
        }
      />
      <section className="card card-accent stack">
        <p className="caption logo-accent">
          Đã lưu vào nhật ký ·{' '}
          {new Date(w.finishedAt).toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
        {justFinished && <h1 className="display">Làm tốt lắm, {firstName}</h1>}
        <div className="metrics">
          <Metric label="Thời gian" value={`${w.durationMin} phút`} />
          <Metric label="Khối lượng" value={kg(w.volumeKg)} accent />
          <Metric label="Set" value={String(w.setCount)} />
          <Metric
            label="RPE trung bình"
            value={w.avgRpe === null ? '—' : String(w.avgRpe).replace('.', ',')}
          />
          <Metric label="Cảm nhận" value={w.feeling ? FEELING_LABELS[w.feeling] : '—'} />
        </div>
        {w.notes && <p className="muted">Ghi chú: {w.notes}</p>}
      </section>
      <section className="card stack">
        <h2>Kết quả từng bài</h2>
        <table className="table">
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Bài tập</th>
              <th scope="col">Các set</th>
              <th scope="col">Khối lượng</th>
            </tr>
          </thead>
          <tbody>
            {byExercise(w).map((g, i) => (
              <tr key={g.name + i}>
                <td className="number muted-num">{String(i + 1).padStart(2, '0')}</td>
                <td>{g.name}</td>
                <td className="muted">
                  {g.sets
                    .map((s) => `${s.weightKg === null ? '' : `${s.weightKg}×`}${s.reps}`)
                    .join(' · ')}
                </td>
                <td className="number">{volumeKg(g.sets) ? kg(volumeKg(g.sets)) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="field-hint">Nhận xét của AI Coach sau buổi tập sẽ có ở mốc M3.</p>
      </section>
    </>
  );
}
