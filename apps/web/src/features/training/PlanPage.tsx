import {
  addDays,
  dateOfDay,
  DAY_LABELS,
  DAYS,
  dayOf,
  mondayOf,
  toIsoDate,
  totalSets,
  type Day,
  type Session,
} from '@ai-coach/shared';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { FormAlert } from '../../components/form.js';
import { Icon } from '../../components/Icon.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { ApiError } from '../../lib/api.js';
import { dayMonth as fmt } from '../../lib/format.js';
import { AiBusy, AiMetaLine } from '../ai/AiBits.js';
import { useGeneratePlan } from '../ai/api.js';
import { useCreatePlan, useDeleteSession, useExercises, usePlan, useSetCompleted } from './api.js';
import { SessionEditor } from './SessionEditor.js';
import './training.css';

export function PlanPage() {
  const [params, setParams] = useSearchParams();
  const today = toIsoDate(new Date());
  const weekStart = mondayOf(params.get('tuan') ?? today);
  const plan = usePlan(weekStart);
  const library = useExercises();
  const createPlan = useCreatePlan();
  const generate = useGeneratePlan();
  const del = useDeleteSession();
  const setDone = useSetCompleted();
  const isThisWeek = weekStart === mondayOf(today);
  const [selected, setSelected] = useState<Day>(isThisWeek ? dayOf(today) : 'mon');
  const [editor, setEditor] = useState<{ day: Day; session?: Session } | null>(null);
  const [alert, setAlert] = useState<string>();

  const goWeek = (by: number) => setParams({ tuan: addDays(weekStart, 7 * by) });
  const sessionsOn = (d: Day) => plan.data?.sessions.filter((s) => s.day === d) ?? [];
  const meta = generate.data?.plan.weekStart === weekStart ? generate.data.meta : undefined;
  const hasSessions = (plan.data?.sessions.length ?? 0) > 0;
  const generateWithAi = () => {
    if (
      hasSessions &&
      !window.confirm(
        'AI sẽ thay toàn bộ buổi tập của tuần này bằng lịch mới. Nhật ký đã tập vẫn được giữ. Tiếp tục?',
      )
    ) {
      return;
    }
    void run(() => generate.mutateAsync(weekStart));
  };
  const run = async (fn: () => Promise<unknown>) => {
    setAlert(undefined);
    try {
      await fn();
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Đã có lỗi xảy ra');
    }
  };

  return (
    <>
      <PageHeader
        caption={`${fmt(weekStart)} – ${fmt(addDays(weekStart, 6))}${isThisWeek ? ' · Tuần này' : ''}`}
        title="Lịch tập tuần"
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => goWeek(-1)}
              aria-label="Tuần trước"
            >
              ← Tuần trước
            </button>
            {!isThisWeek && (
              <button type="button" className="btn btn-secondary" onClick={() => setParams({})}>
                Tuần này
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => goWeek(1)}
              aria-label="Tuần sau"
            >
              Tuần sau →
            </button>
            {plan.data && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={generate.isPending}
                onClick={generateWithAi}
              >
                {hasSessions ? 'Tạo lại bằng AI' : 'Tạo lịch bằng AI'}
              </button>
            )}
          </>
        }
      />
      <FormAlert message={alert} />
      <AiBusy
        active={generate.isPending}
        label="AI đang lập lịch theo hồ sơ, dụng cụ và chấn thương của bạn…"
      />

      {plan.isPending && <p className="muted">Đang tải lịch tập…</p>}
      {plan.data === null && !generate.isPending && (
        <section className="card card-accent stack">
          <p className="caption logo-accent">Chưa có lịch</p>
          <h2>Tuần này chưa có lịch tập</h2>
          <p className="muted">
            AI Coach lập lịch theo mục tiêu, trình độ, số buổi, dụng cụ và chấn thương trong hồ sơ.
            Mọi lịch AI tạo đều được kiểm tra luật an toàn; bạn vẫn sửa được từng buổi. Hoặc tạo
            lịch trống để tự xếp.
          </p>
          <div className="row-actions">
            <button type="button" className="btn btn-primary" onClick={generateWithAi}>
              Tạo lịch bằng AI
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={createPlan.isPending}
              onClick={() => void run(() => createPlan.mutateAsync(weekStart))}
            >
              Tạo lịch trống
            </button>
          </div>
        </section>
      )}

      {plan.data && (
        <>
          {plan.data.aiNote && (
            <section className="card card-accent stack">
              <div className="card-title">
                <p className="caption logo-accent">Vì sao AI đề xuất lịch này</p>
                <span
                  className={`badge ${plan.data.source === 'ai' ? 'badge-primary' : 'badge-neutral'}`}
                >
                  {plan.data.source === 'ai' ? 'AI đề xuất' : 'Mẫu chuẩn'}
                </span>
              </div>
              <p className="ai-note">{plan.data.aiNote}</p>
              {meta && <AiMetaLine meta={meta} />}
            </section>
          )}
          <ol className="week">
            {DAYS.map((d) => {
              const list = sessionsOn(d);
              const date = dateOfDay(weekStart, d);
              const done = list.length > 0 && list.every((s) => s.completedAt);
              return (
                <li key={d}>
                  <button
                    type="button"
                    className={`day ${date === today ? 'is-today' : ''} ${list.length === 0 ? 'is-rest' : ''}`}
                    aria-pressed={selected === d}
                    onClick={() => setSelected(d)}
                  >
                    <span className="caption">
                      {DAY_LABELS[d]} · {fmt(date)}
                    </span>
                    <span className="day-title">{list[0]?.title ?? 'Nghỉ'}</span>
                    {list.length > 1 && <span className="muted">+{list.length - 1} buổi</span>}
                    {list.length > 0 && (
                      <span
                        className={`badge ${done ? 'badge-solid' : date === today ? 'badge-primary' : 'badge-neutral'}`}
                      >
                        {done
                          ? 'Đã tập'
                          : date === today
                            ? 'Hôm nay'
                            : date < today
                              ? 'Bỏ lỡ'
                              : 'Sắp tới'}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <section className="stack">
            <div className="card-title">
              <h2>
                {DAY_LABELS[selected]} · {fmt(dateOfDay(weekStart, selected))}
              </h2>
              <button
                type="button"
                className="btn btn-primary btn-icon"
                disabled={!library.data}
                onClick={() => setEditor({ day: selected })}
              >
                + Thêm buổi tập
              </button>
            </div>
            {sessionsOn(selected).length === 0 && (
              <div className="empty">Ngày nghỉ. Thêm buổi tập nếu bạn muốn tập ngày này.</div>
            )}
            {sessionsOn(selected).map((s) => (
              <article key={s.id} className="card stack">
                <div className="card-title">
                  <div>
                    <h2>{s.title}</h2>
                    <p className="muted">
                      {s.durationMin} phút · {s.exercises.length} bài · {totalSets(s.exercises)} set
                      {s.notes && ` · ${s.notes}`}
                    </p>
                  </div>
                  {s.completedAt && <span className="badge badge-solid">Đã tập</span>}
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">#</th>
                      <th scope="col">Bài tập</th>
                      <th scope="col">Set × rep</th>
                      <th scope="col">Tạ</th>
                      <th scope="col">Nghỉ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.exercises.map((e, i) => (
                      <tr key={e.id}>
                        <td className="number muted-num">{String(i + 1).padStart(2, '0')}</td>
                        <td>
                          <Link to={`/thu-vien/${e.exercise.slug}`} className="table-link">
                            {e.exercise.name}
                          </Link>
                          {e.exercise.cameraSupported && (
                            <span className="badge badge-neutral table-badge">Camera</span>
                          )}
                        </td>
                        <td>
                          {e.sets} × {e.reps}
                        </td>
                        <td className="muted">{e.weightKg === null ? '—' : `${e.weightKg} kg`}</td>
                        <td className="muted">{e.restSeconds} giây</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="row-actions">
                  <Link to={`/buoi-tap/${s.id}`} className="btn btn-primary btn-icon">
                    <Icon name="dumbbell" size={20} /> Bắt đầu buổi tập
                  </Link>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setEditor({ day: s.day, session: s })}
                  >
                    Chỉnh sửa
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() =>
                      void run(() => setDone.mutateAsync({ id: s.id, completed: !s.completedAt }))
                    }
                  >
                    {s.completedAt ? 'Bỏ đánh dấu hoàn thành' : 'Đánh dấu hoàn thành'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-danger"
                    onClick={() => {
                      if (window.confirm(`Xóa buổi "${s.title}"? Lịch sử đã tập vẫn được giữ.`)) {
                        void run(() => del.mutateAsync(s.id));
                      }
                    }}
                  >
                    Xóa
                  </button>
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {editor && plan.data && library.data && (
        <SessionEditor
          planId={plan.data.id}
          day={editor.day}
          session={editor.session}
          library={library.data}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  );
}
