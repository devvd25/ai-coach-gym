import { EQUIPMENT_LABELS, LEVEL_LABELS, MUSCLE_LABELS, type Exercise } from '@ai-coach/shared';

export function ExerciseDetail({ exercise: e }: { exercise: Exercise }) {
  return (
    <article className="stack exercise-detail">
      <div>
        <p className="caption logo-accent">
          {MUSCLE_LABELS[e.muscleGroup]}
          {e.secondaryMuscles && ` · ${e.secondaryMuscles}`}
        </p>
        <h1 className="exercise-detail-title">{e.name}</h1>
      </div>
      <div className="tags">
        <span className="badge badge-neutral">{EQUIPMENT_LABELS[e.equipment]}</span>
        <span className="badge badge-neutral">{LEVEL_LABELS[e.level]}</span>
        {e.cameraSupported && <span className="badge badge-primary">Hỗ trợ đếm bằng camera</span>}
      </div>
      <p className="muted">{e.description}</p>
      <dl className="facts">
        <div>
          <dt>Gợi ý</dt>
          <dd>
            {e.defaultSets} set ×{' '}
            {e.defaultReps.endsWith('s')
              ? `${e.defaultReps.slice(0, -1)} giây`
              : `${e.defaultReps} rep`}
          </dd>
        </div>
        <div>
          <dt>Nghỉ giữa set</dt>
          <dd>{e.restSeconds} giây</dd>
        </div>
      </dl>
      <section className="stack" style={{ gap: 12 }}>
        <h3 className="section-title">Cách thực hiện</h3>
        <ol className="numbered">
          {e.steps.map((s, i) => (
            <li key={i}>
              <span className="number numbered-n">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
      <section className="stack" style={{ gap: 12 }}>
        <h3 className="section-title">Lỗi thường gặp</h3>
        <ol className="numbered numbered-muted">
          {e.mistakes.map((s, i) => (
            <li key={i}>
              <span className="number numbered-n">{String(i + 1).padStart(2, '0')}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
