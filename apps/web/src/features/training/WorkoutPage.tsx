import { FEELING_LABELS, FEELINGS, type Session, type Workout } from '@ai-coach/shared';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { FormAlert } from '../../components/form.js';
import { Icon } from '../../components/Icon.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { useLogWorkout, useSession } from './api.js';
import {
  draftFromSession,
  formatClock,
  toWorkoutInput,
  type DraftExercise,
  type DraftSet,
} from './workout-draft.js';
import './training.css';

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function WorkoutPage() {
  const id = Number(useParams().sessionId);
  const session = useSession(id);
  if (session.isPending) return <p className="muted">Đang tải buổi tập…</p>;
  if (session.isError) {
    return (
      <div className="empty">
        Không tìm thấy buổi tập này.{' '}
        <Link to="/lich-tap" className="link">
          Về lịch tập
        </Link>
      </div>
    );
  }
  return <WorkoutLogger session={session.data} />;
}

function WorkoutLogger({ session }: { session: Session }) {
  const navigate = useNavigate();
  const log = useLogWorkout();
  const now = useNow();
  const [startedAt] = useState(() => new Date());
  const [draft, setDraft] = useState<DraftExercise[]>(() => draftFromSession(session));
  const [current, setCurrent] = useState(0);
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [feeling, setFeeling] = useState<Workout['feeling']>('right');
  const [notes, setNotes] = useState('');
  const [alert, setAlert] = useState<string>();

  const doneSets = draft.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const allSets = draft.reduce((n, e) => n + e.sets.length, 0);
  const restLeft = rest ? Math.max(0, (rest.until - now) / 1000) : 0;
  const ex = draft[current];

  function updateSet(exIndex: number, setIndex: number, patch: Partial<DraftSet>) {
    setDraft((d) =>
      d.map((e, i) =>
        i !== exIndex
          ? e
          : { ...e, sets: e.sets.map((s, j) => (j === setIndex ? { ...s, ...patch } : s)) },
      ),
    );
  }

  function toggleDone(exIndex: number, setIndex: number) {
    const set = draft[exIndex]?.sets[setIndex];
    if (!set) return;
    updateSet(exIndex, setIndex, { done: !set.done });
    if (!set.done) {
      const seconds = draft[exIndex]?.restSeconds ?? 60;
      setRest({ until: Date.now() + seconds * 1000, total: seconds });
    }
  }

  function addSet(exIndex: number) {
    setDraft((d) =>
      d.map((e, i) => {
        if (i !== exIndex) return e;
        const last = e.sets.at(-1);
        return {
          ...e,
          sets: [
            ...e.sets,
            { reps: last?.reps ?? '', weightKg: last?.weightKg ?? '', rpe: '', done: false },
          ],
        };
      }),
    );
  }

  async function finish() {
    setAlert(undefined);
    const input = toWorkoutInput(draft, {
      sessionId: session.id,
      title: session.title,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      notes: notes.trim(),
      feeling,
    });
    if (!input) {
      setAlert('Đánh dấu ít nhất 1 set đã hoàn thành trước khi kết thúc buổi tập.');
      return;
    }
    try {
      const saved = await log.mutateAsync(input);
      navigate(`/nhat-ky/${saved.id}`, { replace: true, state: { justFinished: true } });
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Không lưu được buổi tập, vui lòng thử lại');
    }
  }

  return (
    <>
      <PageHeader
        caption={`Đang tập · ${formatClock((now - startedAt.getTime()) / 1000)}`}
        title={session.title}
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setFinishing(true)}>
            Kết thúc buổi tập
          </button>
        }
      />
      <FormAlert message={alert} />

      <section className="card stack">
        <div className="metrics">
          <Metric
            label="Thời gian"
            value={formatClock((now - startedAt.getTime()) / 1000)}
            accent
          />
          <Metric label="Bài" value={`${current + 1} / ${draft.length}`} />
          <Metric label="Set hoàn thành" value={`${doneSets} / ${allSets}`} />
        </div>
        <div className="progress" aria-hidden="true">
          <span style={{ width: `${allSets ? (doneSets / allSets) * 100 : 0}%` }} />
        </div>
      </section>

      <div className="workout">
        {ex && (
          <section className="card stack">
            <div>
              <p className="caption logo-accent">
                Bài {String(current + 1).padStart(2, '0')} / {String(draft.length).padStart(2, '0')}
              </p>
              <h2 className="workout-title">{ex.name}</h2>
              <p className="muted">
                Mục tiêu {ex.target} · nghỉ {ex.restSeconds} giây
              </p>
            </div>
            <div className="set-head" aria-hidden="true">
              <span>Set</span>
              <span>Kg</span>
              <span>Rep</span>
              <span>RPE</span>
              <span>Xong</span>
            </div>
            {ex.sets.map((s, j) => (
              <div key={j} className={`set-row ${s.done ? 'is-done' : ''}`}>
                <span className="number">{j + 1}</span>
                <input
                  className="input input-sm"
                  inputMode="decimal"
                  aria-label={`Kg set ${j + 1}`}
                  placeholder="—"
                  value={s.weightKg}
                  onChange={(e) => updateSet(current, j, { weightKg: e.target.value })}
                />
                <input
                  className="input input-sm"
                  inputMode="numeric"
                  aria-label={`Rep set ${j + 1}`}
                  value={s.reps}
                  onChange={(e) => updateSet(current, j, { reps: e.target.value })}
                />
                <input
                  className="input input-sm"
                  inputMode="decimal"
                  aria-label={`RPE set ${j + 1}`}
                  placeholder="1–10"
                  value={s.rpe}
                  onChange={(e) => updateSet(current, j, { rpe: e.target.value })}
                />
                <button
                  type="button"
                  className="set-check"
                  aria-pressed={s.done}
                  aria-label={`Hoàn thành set ${j + 1}`}
                  onClick={() => toggleDone(current, j)}
                >
                  {s.done && <Icon name="check" size={20} />}
                </button>
              </div>
            ))}
            <div className="row-actions">
              <button type="button" className="btn btn-secondary" onClick={() => addSet(current)}>
                + Thêm set
              </button>
              {ex.cameraSupported && (
                <Link to="/camera" className="btn btn-secondary btn-icon">
                  <Icon name="camera" size={20} /> Đếm bằng camera
                </Link>
              )}
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
              >
                ← Bài trước
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={current === draft.length - 1}
                onClick={() => setCurrent((c) => c + 1)}
              >
                Bài tiếp →
              </button>
            </div>
          </section>
        )}

        <aside className="stack">
          <section className={`card stack ${rest && restLeft > 0 ? 'card-accent' : ''}`}>
            <p className="caption">Nghỉ giữa set</p>
            <p className="rest-clock" aria-live="polite">
              {rest && restLeft > 0 ? formatClock(restLeft) : '—'}
            </p>
            {rest && restLeft > 0 && (
              <>
                <div className="progress" aria-hidden="true">
                  <span style={{ width: `${(restLeft / rest.total) * 100}%` }} />
                </div>
                <div className="row">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setRest((r) => r && { ...r, until: r.until - 15_000 })}
                  >
                    −15 giây
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setRest((r) => r && { ...r, until: r.until + 15_000 })}
                  >
                    +15 giây
                  </button>
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => setRest(null)}>
                  Bỏ qua thời gian nghỉ
                </button>
              </>
            )}
          </section>
          <section className="card">
            <h2>Buổi hôm nay</h2>
            <ol className="session-list">
              {draft.map((e, i) => {
                const done = e.sets.filter((s) => s.done).length;
                return (
                  <li key={e.exerciseId + '-' + i}>
                    <button
                      type="button"
                      className="session-item"
                      aria-current={i === current ? 'step' : undefined}
                      onClick={() => setCurrent(i)}
                    >
                      <span className="number numbered-n">{String(i + 1).padStart(2, '0')}</span>
                      <span className="session-item-name">{e.name}</span>
                      <span
                        className={`badge ${done === e.sets.length ? 'badge-solid' : i === current ? 'badge-primary' : 'badge-neutral'}`}
                      >
                        {done === e.sets.length ? 'Xong' : `${done}/${e.sets.length}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </div>

      {finishing && (
        <section className="card card-accent stack" aria-labelledby="finish-title">
          <h2 id="finish-title">Kết thúc buổi tập</h2>
          <p className="muted">
            Đã hoàn thành {doneSets}/{allSets} set. Chỉ những set đã đánh dấu mới được lưu vào nhật
            ký.
          </p>
          <div className="filter-group" role="group" aria-label="Cảm nhận buổi tập">
            <span className="caption">Buổi tập thế nào?</span>
            {FEELINGS.map((f) => (
              <button
                key={f}
                type="button"
                className="pill"
                aria-pressed={feeling === f}
                onClick={() => setFeeling(f)}
              >
                {FEELING_LABELS[f]}
              </button>
            ))}
          </div>
          <label className="field">
            <span className="field-label">Ghi chú (không bắt buộc)</span>
            <input
              className="input"
              maxLength={500}
              placeholder="Ví dụ: gối trái hơi mỏi ở set cuối"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <div className="row-actions">
            <button type="button" className="btn btn-secondary" onClick={() => setFinishing(false)}>
              Tập tiếp
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={log.isPending}
              onClick={() => void finish()}
            >
              {log.isPending ? 'Đang lưu…' : 'Lưu vào nhật ký'}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

export function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="mini">
      <span className="caption">{label}</span>
      <span className={`number ${accent ? 'logo-accent' : ''}`}>{value}</span>
    </div>
  );
}
