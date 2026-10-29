import type { Session, WorkoutInput, WorkoutSetInput } from '@ai-coach/shared';

export interface DraftSet {
  reps: string;
  weightKg: string;
  rpe: string;
  done: boolean;
}

export interface DraftExercise {
  exerciseId: number;
  name: string;
  slug: string;
  cameraSupported: boolean;
  target: string;
  restSeconds: number;
  sets: DraftSet[];
}

/** First number of "8", "8-12" or "45s"; timed holds are logged as seconds in the reps field. */
export function targetReps(reps: string): number {
  const n = Number.parseInt(reps, 10);
  return Number.isFinite(n) ? n : 0;
}

export function draftFromSession(session: Session): DraftExercise[] {
  return session.exercises.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.exercise.name,
    slug: e.exercise.slug,
    cameraSupported: e.exercise.cameraSupported,
    target: `${e.sets} × ${e.reps}${e.weightKg === null ? '' : ` · ${e.weightKg} kg`}`,
    restSeconds: e.restSeconds,
    sets: Array.from({ length: e.sets }, () => ({
      reps: String(targetReps(e.reps)),
      weightKg: e.weightKg === null ? '' : String(e.weightKg).replace('.', ','),
      rpe: '',
      done: false,
    })),
  }));
}

const num = (s: string) => Number(s.trim().replace(',', '.'));

/** Only ticked sets are logged; blank weight/RPE become null. Returns null when nothing is done. */
export function toWorkoutInput(
  draft: DraftExercise[],
  meta: Pick<
    WorkoutInput,
    'sessionId' | 'title' | 'startedAt' | 'finishedAt' | 'notes' | 'feeling'
  >,
): WorkoutInput | null {
  const sets: WorkoutSetInput[] = draft.flatMap((ex) =>
    ex.sets
      .map((s, i) => ({ s, setNumber: i + 1 }))
      .filter(({ s }) => s.done)
      .map(({ s, setNumber }) => ({
        exerciseId: ex.exerciseId,
        setNumber,
        reps: Math.round(num(s.reps)) || 0,
        weightKg: s.weightKg.trim() === '' ? null : num(s.weightKg),
        rpe: s.rpe.trim() === '' ? null : Math.round(num(s.rpe) * 2) / 2,
      })),
  );
  return sets.length ? { ...meta, sets } : null;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(sec).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
