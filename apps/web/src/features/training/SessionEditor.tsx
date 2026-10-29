import {
  DAY_LABELS,
  DAYS,
  fieldErrors,
  MAX_SETS_PER_SESSION,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  sessionInputSchema,
  totalSets,
  type Day,
  type Exercise,
  type Session,
  type SessionInput,
} from '@ai-coach/shared';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ChoiceGroup, FormAlert, TextField } from '../../components/form.js';
import { ApiError } from '../../lib/api.js';
import { useSaveSession } from './api.js';

interface Row {
  key: number;
  exerciseId: number;
  sets: string;
  reps: string;
  weightKg: string;
  restSeconds: string;
}

let nextKey = 1;
const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')));

function rowFor(e: Exercise): Row {
  return {
    key: nextKey++,
    exerciseId: e.id,
    sets: String(e.defaultSets),
    reps: e.defaultReps.split('-')[0] ?? e.defaultReps,
    weightKg: '',
    restSeconds: String(e.restSeconds),
  };
}

export function toSessionInput(
  head: { day: Day; title: string; durationMin: string; notes: string },
  rows: Row[],
): unknown {
  return {
    day: head.day,
    title: head.title,
    durationMin: num(head.durationMin),
    notes: head.notes,
    exercises: rows.map((r) => ({
      exerciseId: r.exerciseId,
      sets: num(r.sets),
      reps: r.reps.trim(),
      weightKg: r.weightKg.trim() === '' ? null : num(r.weightKg),
      restSeconds: num(r.restSeconds),
    })),
  };
}

/** Modal (Figma 12) to create or edit one planned session. */
export function SessionEditor({
  planId,
  day,
  session,
  library,
  onClose,
}: {
  planId: number;
  day: Day;
  session?: Session;
  library: Exercise[];
  onClose(): void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const save = useSaveSession();
  const [head, setHead] = useState({
    day: session?.day ?? day,
    title: session?.title ?? '',
    durationMin: String(session?.durationMin ?? 60),
    notes: session?.notes ?? '',
  });
  const [rows, setRows] = useState<Row[]>(
    () =>
      session?.exercises.map((e) => ({
        key: nextKey++,
        exerciseId: e.exerciseId,
        sets: String(e.sets),
        reps: e.reps,
        weightKg: e.weightKg === null ? '' : String(e.weightKg).replace('.', ','),
        restSeconds: String(e.restSeconds),
      })) ?? [],
  );
  const [picker, setPicker] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alert, setAlert] = useState<string>();

  useEffect(() => {
    const d = dialog.current;
    d?.showModal();
    return () => d?.close();
  }, []);

  const byId = new Map(library.map((e) => [e.id, e]));
  const sets = totalSets(rows.map((r) => ({ sets: num(r.sets) || 0 })));
  const update = (key: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const move = (index: number, by: -1 | 1) =>
    setRows((rs) => {
      const next = [...rs];
      const [item] = next.splice(index, 1);
      if (item) next.splice(index + by, 0, item);
      return next;
    });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAlert(undefined);
    const parsed = sessionInputSchema.safeParse(toSessionInput(head, rows));
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setAlert(
        'Kiểm tra lại các ô được đánh dấu. Mỗi bài cần số set, rep và thời gian nghỉ hợp lệ.',
      );
      return;
    }
    try {
      await save.mutateAsync({
        planId,
        sessionId: session?.id,
        input: parsed.data as SessionInput,
      });
      onClose();
    } catch (err) {
      setAlert(err instanceof ApiError ? err.message : 'Không lưu được buổi tập');
    }
  }

  return (
    <dialog ref={dialog} className="modal" onClose={onClose} aria-labelledby="session-editor-title">
      <form className="stack" onSubmit={onSubmit} noValidate>
        <div className="modal-head">
          <div>
            <p className="caption logo-accent">{session ? 'Sửa buổi tập' : 'Thêm buổi tập'}</p>
            <h1 id="session-editor-title">{head.title || 'Buổi tập mới'}</h1>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Đóng
          </button>
        </div>
        <FormAlert message={alert} />
        <div className="row">
          <TextField
            label="Tên buổi"
            placeholder="Ví dụ: Thân dưới A"
            value={head.title}
            onChange={(title) => setHead((h) => ({ ...h, title }))}
            error={errors.title}
            maxLength={60}
          />
          <TextField
            label="Thời lượng (phút)"
            inputMode="numeric"
            value={head.durationMin}
            onChange={(durationMin) => setHead((h) => ({ ...h, durationMin }))}
            error={errors.durationMin}
          />
        </div>
        <ChoiceGroup
          label="Ngày"
          variant="square"
          options={DAYS.map((d) => ({ value: d, label: DAY_LABELS[d] }))}
          selected={[head.day]}
          onToggle={(d) => setHead((h) => ({ ...h, day: d }))}
        />

        <div className="stack" style={{ gap: 8 }}>
          <div className="editor-head" aria-hidden="true">
            <span>Bài tập</span>
            <span>Set</span>
            <span>Rep</span>
            <span>Kg</span>
            <span>Nghỉ (giây)</span>
            <span />
          </div>
          {rows.map((r, i) => {
            const ex = byId.get(r.exerciseId);
            return (
              <div key={r.key} className="editor-row">
                <span className="editor-name">
                  <span className="number numbered-n">{String(i + 1).padStart(2, '0')}</span>
                  {ex?.name ?? 'Bài không xác định'}
                </span>
                <input
                  className="input input-sm"
                  aria-label={`Số set ${ex?.name}`}
                  inputMode="numeric"
                  value={r.sets}
                  onChange={(e) => update(r.key, { sets: e.target.value })}
                />
                <input
                  className="input input-sm"
                  aria-label={`Số rep ${ex?.name}`}
                  value={r.reps}
                  onChange={(e) => update(r.key, { reps: e.target.value })}
                />
                <input
                  className="input input-sm"
                  aria-label={`Mức tạ ${ex?.name}`}
                  inputMode="decimal"
                  placeholder="—"
                  value={r.weightKg}
                  onChange={(e) => update(r.key, { weightKg: e.target.value })}
                />
                <input
                  className="input input-sm"
                  aria-label={`Thời gian nghỉ ${ex?.name}`}
                  inputMode="numeric"
                  value={r.restSeconds}
                  onChange={(e) => update(r.key, { restSeconds: e.target.value })}
                />
                <span className="editor-actions">
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Chuyển lên"
                    disabled={i === 0}
                    onClick={() => move(i, -1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label="Chuyển xuống"
                    disabled={i === rows.length - 1}
                    onClick={() => move(i, 1)}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="icon-btn"
                    aria-label={`Xóa ${ex?.name}`}
                    onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}
                  >
                    ✕
                  </button>
                </span>
              </div>
            );
          })}
          {errors.exercises && <p className="field-error">{errors.exercises}</p>}
          <div className="editor-add">
            <label className="field" style={{ flex: 1 }}>
              <span className="field-label">Thêm bài từ thư viện</span>
              <select className="input" value={picker} onChange={(e) => setPicker(e.target.value)}>
                <option value="">Chọn bài tập…</option>
                {MUSCLE_GROUPS.map((m) => (
                  <optgroup key={m} label={MUSCLE_LABELS[m]}>
                    {library
                      .filter((e) => e.muscleGroup === m)
                      .map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!picker || rows.length >= 12}
              onClick={() => {
                const ex = byId.get(Number(picker));
                if (ex) setRows((rs) => [...rs, rowFor(ex)]);
                setPicker('');
              }}
            >
              Thêm bài
            </button>
          </div>
          <p className={sets > MAX_SETS_PER_SESSION ? 'field-error' : 'field-hint'}>
            Tổng {sets} set
            {sets > MAX_SETS_PER_SESSION
              ? ` — vượt mức khuyến nghị ${MAX_SETS_PER_SESSION} set/buổi, nên chia bớt sang buổi khác.`
              : ` — trong giới hạn ${MAX_SETS_PER_SESSION} set/buổi.`}
          </p>
        </div>

        <TextField
          label="Ghi chú (không bắt buộc)"
          placeholder="Ví dụ: khởi động 8 phút trước bài chính"
          value={head.notes}
          onChange={(notes) => setHead((h) => ({ ...h, notes }))}
          maxLength={300}
        />
        <div className="modal-foot">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Hủy
          </button>
          <button type="submit" className="btn btn-primary" disabled={save.isPending}>
            {save.isPending ? 'Đang lưu…' : 'Lưu buổi tập'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
