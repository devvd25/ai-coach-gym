import {
  EQUIPMENT,
  EQUIPMENT_LABELS,
  filterExercises,
  LEVEL_LABELS,
  LEVELS,
  MUSCLE_GROUPS,
  MUSCLE_LABELS,
  type ExerciseQuery,
} from '@ai-coach/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Icon } from '../../components/Icon.js';
import { PageHeader } from '../../layouts/AppLayout.js';
import { useExercises } from './api.js';
import { ExerciseDetail } from './ExerciseDetail.js';
import './training.css';

function FilterChips<T extends string>({
  label,
  values,
  labels,
  value,
  onChange,
}: {
  label: string;
  values: readonly T[];
  labels: Record<T, string>;
  value: T | undefined;
  onChange(v: T | undefined): void;
}) {
  return (
    <div className="filter-group" role="group" aria-label={label}>
      <span className="caption">{label}</span>
      <button
        type="button"
        className="pill"
        aria-pressed={!value}
        onClick={() => onChange(undefined)}
      >
        Tất cả
      </button>
      {values.map((v) => (
        <button
          key={v}
          type="button"
          className="pill"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

export function LibraryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const exercises = useExercises();
  const [query, setQuery] = useState<ExerciseQuery>({});
  const list = useMemo(() => filterExercises(exercises.data ?? [], query), [exercises.data, query]);
  const selected = exercises.data?.find((e) => e.slug === slug) ?? list[0];
  const patch = (p: Partial<ExerciseQuery>) => setQuery((q) => ({ ...q, ...p }));

  return (
    <>
      <PageHeader
        caption={`${exercises.data?.length ?? '…'} bài · lọc theo nhóm cơ, dụng cụ và độ khó`}
        title="Thư viện bài tập"
      />
      <section className="card stack filters">
        <label className="field">
          <span className="field-label">Tìm bài tập</span>
          <input
            className="input"
            type="search"
            placeholder="Ví dụ: squat, ngực, đùi sau…"
            value={query.q ?? ''}
            onChange={(e) => patch({ q: e.target.value || undefined })}
          />
        </label>
        <FilterChips
          label="Nhóm cơ"
          values={MUSCLE_GROUPS}
          labels={MUSCLE_LABELS}
          value={query.muscle}
          onChange={(muscle) => patch({ muscle })}
        />
        <div className="filters-row">
          <FilterChips
            label="Dụng cụ"
            values={EQUIPMENT}
            labels={EQUIPMENT_LABELS}
            value={query.equipment}
            onChange={(equipment) => patch({ equipment })}
          />
          <FilterChips
            label="Độ khó"
            values={LEVELS}
            labels={LEVEL_LABELS}
            value={query.level}
            onChange={(level) => patch({ level })}
          />
        </div>
      </section>

      {exercises.isPending && <p className="muted">Đang tải thư viện…</p>}
      {exercises.isError && <p className="form-alert">Không tải được thư viện bài tập.</p>}
      {exercises.data && (
        <div className="library">
          <div className="stack" style={{ gap: 12 }}>
            <p className="muted">
              Hiển thị {list.length} / {exercises.data.length} bài
            </p>
            {list.length === 0 && (
              <div className="empty">Không có bài nào khớp bộ lọc. Thử bỏ bớt điều kiện.</div>
            )}
            <ul className="exercise-grid">
              {list.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/thu-vien/${e.slug}`}
                    className="exercise-card"
                    aria-current={selected?.id === e.id ? 'true' : undefined}
                    onClick={(ev) => {
                      // On desktop the detail panel updates in place; on mobile it opens as a page.
                      if (window.matchMedia('(min-width: 1024px)').matches) {
                        ev.preventDefault();
                        navigate(`/thu-vien/${e.slug}`, { replace: true });
                      }
                    }}
                  >
                    <span className="exercise-card-top">
                      <span className="caption">{MUSCLE_LABELS[e.muscleGroup]}</span>
                      {e.cameraSupported && <span className="badge badge-primary">Camera</span>}
                    </span>
                    <span className="exercise-card-name">{e.name}</span>
                    <span className="muted">
                      {EQUIPMENT_LABELS[e.equipment]} · {LEVEL_LABELS[e.level]}
                    </span>
                    <span className="exercise-card-chevron" aria-hidden="true">
                      <Icon name="chevron" size={20} />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
          {selected && (
            <aside className={`card card-accent library-detail ${slug ? 'is-open' : ''}`}>
              {slug && (
                <Link to="/thu-vien" className="btn btn-secondary btn-icon library-back">
                  <Icon name="back" size={20} /> Về thư viện
                </Link>
              )}
              <ExerciseDetail exercise={selected} />
            </aside>
          )}
        </div>
      )}
    </>
  );
}
