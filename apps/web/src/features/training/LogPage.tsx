import { FEELING_LABELS, toIsoDate, weightInputSchema, fieldErrors } from '@ai-coach/shared';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FormAlert, TextField } from '../../components/form.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { dayMonth as dm, kg } from '../../lib/format.js';
import { useDeleteWeight, useSaveWeight, useWeights, useWorkouts } from './api.js';
import { Metric } from './WorkoutPage.js';
import './training.css';

export function LogPage() {
  const workouts = useWorkouts(28);
  const weights = useWeights(180);
  const save = useSaveWeight();
  const del = useDeleteWeight();
  const today = toIsoDate(new Date());
  const [form, setForm] = useState({ date: today, weightKg: '', note: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();

  const list = workouts.data ?? [];
  const volume = list.reduce((v, w) => v + w.volumeKg, 0);
  const minutes = list.reduce((m, w) => m + w.durationMin, 0);
  const entries = weights.data ?? [];
  const latest = entries.at(-1);
  const first = entries[0];
  const chart = entries.map((e) => ({ date: dm(e.date), kg: e.weightKg }));

  async function onSave(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    const parsed = weightInputSchema.safeParse({
      weightKg: form.weightKg.trim() === '' ? undefined : Number(form.weightKg.replace(',', '.')),
      note: form.note,
    });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    try {
      await save.mutateAsync({ date: form.date, ...parsed.data });
      setForm((f) => ({ ...f, weightKg: '', note: '' }));
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Không lưu được cân nặng');
    }
  }

  return (
    <>
      <PageHeader caption="Lịch sử buổi tập và cân nặng" title="Nhật ký & tiến độ" />
      <section className="stats">
        <div className="card">
          <Metric label="Buổi tập (4 tuần)" value={String(list.length)} />
        </div>
        <div className="card">
          <Metric label="Tổng khối lượng" value={kg(Math.round(volume))} />
        </div>
        <div className="card">
          <Metric
            label="Thời gian tập"
            value={`${(minutes / 60).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giờ`}
          />
        </div>
        <div className="card">
          <Metric label="Cân nặng" value={latest ? kg(latest.weightKg) : '—'} />
          {latest && first && latest !== first && (
            <p className="muted">
              {latest.weightKg - first.weightKg > 0 ? '+' : ''}
              {(latest.weightKg - first.weightKg).toLocaleString('vi-VN', {
                maximumFractionDigits: 1,
              })}{' '}
              kg từ {dm(first.date)}
            </p>
          )}
        </div>
      </section>

      <div className="log-grid">
        <section className="card stack">
          <h2>Cân nặng</h2>
          {chart.length < 2 ? (
            <div className="empty">Ghi cân nặng ít nhất 2 ngày để xem biểu đồ.</div>
          ) : (
            <div
              className="chart"
              role="img"
              aria-label={`Biểu đồ cân nặng từ ${dm(entries[0]!.date)} đến ${dm(latest!.date)}`}
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chart} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="var(--color-text-muted)"
                    tickLine={false}
                    fontSize={12}
                  />
                  <YAxis
                    domain={['dataMin - 1', 'dataMax + 1']}
                    stroke="var(--color-text-muted)"
                    tickLine={false}
                    fontSize={12}
                  />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-surface-2)',
                      border: '1px solid var(--color-border)',
                      borderRadius: 8,
                    }}
                    formatter={(v) => [`${String(v)} kg`, 'Cân nặng']}
                  />
                  <Line
                    type="monotone"
                    dataKey="kg"
                    stroke="var(--color-primary)"
                    strokeWidth={3}
                    dot={{ r: 3, fill: 'var(--color-primary)' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
          {entries.length > 0 && (
            <ul className="weight-list">
              {[...entries]
                .reverse()
                .slice(0, 6)
                .map((e) => (
                  <li key={e.date}>
                    <span className="muted">{dm(e.date)}</span>
                    <span className="number">{kg(e.weightKg)}</span>
                    <span className="muted weight-note">{e.note}</span>
                    <button
                      type="button"
                      className="btn btn-ghost btn-danger"
                      onClick={() => void del.mutateAsync(e.date)}
                    >
                      Xóa
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        <form className="card stack" onSubmit={onSave} noValidate>
          <h2>Ghi nhanh cân nặng</h2>
          <FormAlert message={alert} />
          <TextField
            label="Cân nặng (kg)"
            inputMode="decimal"
            placeholder="Ví dụ: 68,4"
            value={form.weightKg}
            onChange={(weightKg) => setForm((f) => ({ ...f, weightKg }))}
            error={errors.weightKg}
          />
          <TextField
            label="Ngày đo"
            type="date"
            max={today}
            value={form.date}
            onChange={(date) => setForm((f) => ({ ...f, date }))}
          />
          <TextField
            label="Ghi chú (không bắt buộc)"
            placeholder="Ví dụ: đo buổi sáng, trước khi ăn"
            value={form.note}
            onChange={(note) => setForm((f) => ({ ...f, note }))}
            error={errors.note}
            maxLength={120}
          />
          <button type="submit" className="btn btn-primary btn-block" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu cân nặng'}
          </button>
          <p className="field-hint">Ghi lại cùng một ngày sẽ thay số đo cũ.</p>
        </form>
      </div>

      <section className="card stack">
        <h2>Lịch sử buổi tập</h2>
        {list.length === 0 ? (
          <div className="empty">
            Chưa có buổi tập nào trong 4 tuần qua.{' '}
            <Link to="/lich-tap" className="link">
              Mở lịch tập
            </Link>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                <th scope="col">Buổi tập</th>
                <th scope="col">Thời gian</th>
                <th scope="col">Khối lượng</th>
                <th scope="col">RPE TB</th>
                <th scope="col">Cảm nhận</th>
              </tr>
            </thead>
            <tbody>
              {list.map((w) => (
                <tr key={w.id}>
                  <td className="muted">{dm(w.startedAt)}</td>
                  <td>
                    <Link to={`/nhat-ky/${w.id}`} className="table-link">
                      {w.title}
                    </Link>
                  </td>
                  <td className="muted">{w.durationMin} phút</td>
                  <td className="number">{w.volumeKg ? kg(w.volumeKg) : '—'}</td>
                  <td className="muted">
                    {w.avgRpe === null ? '—' : String(w.avgRpe).replace('.', ',')}
                  </td>
                  <td>
                    {w.feeling ? (
                      <span className="badge badge-neutral">{FEELING_LABELS[w.feeling]}</span>
                    ) : (
                      '—'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
