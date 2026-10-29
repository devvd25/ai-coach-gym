import type { CounterConfig } from './config.js';
import type { CounterState } from './counter.js';

/** One uploaded video processed offline, ready to compare with a hand-counted ground truth. */
export interface EvaluationRow {
  video: string;
  model: string;
  fps: number;
  durationSec: number;
  processingSec: number;
  result: CounterState;
  /** Reps counted by hand while watching the video; filled in on the page or later in the CSV. */
  groundTruth?: number | null;
}

export const CSV_COLUMNS = [
  'video',
  'model',
  'sample_fps',
  'duration_s',
  'frames',
  'low_visibility_frames',
  'rep_count',
  'rep_timestamps_s',
  'rep_min_angles_deg',
  'ground_truth_reps',
  'processing_s',
  'config',
] as const;

function cell(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

const fixed = (n: number, digits: number) => n.toFixed(digits);

export function configLabel(cfg: CounterConfig): string {
  return `down=${cfg.downAngle};up=${cfg.upAngle};ema=${cfg.emaAlpha};vis=${cfg.minVisibility};minRepMs=${cfg.minRepMs}`;
}

/** CSV for the counting experiment (AGENTS.md §6); ground_truth_reps stays empty if not entered. */
export function evaluationCsv(rows: readonly EvaluationRow[], cfg: CounterConfig): string {
  const lines = rows.map((r) =>
    [
      r.video,
      r.model,
      r.fps,
      fixed(r.durationSec, 2),
      r.result.frames,
      r.result.lowVisibilityFrames,
      r.result.reps.length,
      r.result.reps.map((rep) => fixed(rep.timestampMs / 1000, 2)).join(';'),
      r.result.reps.map((rep) => fixed(rep.minAngle, 1)).join(';'),
      r.groundTruth ?? '',
      fixed(r.processingSec, 1),
      configLabel(cfg),
    ]
      .map(cell)
      .join(','),
  );
  return [CSV_COLUMNS.join(','), ...lines].join('\r\n') + '\r\n';
}

/** Mean absolute error and exact-match rate over the rows that have a ground truth. */
export function countingAccuracy(rows: readonly EvaluationRow[]) {
  const scored = rows.filter(
    (r): r is EvaluationRow & { groundTruth: number } => r.groundTruth != null,
  );
  if (scored.length === 0) return null;
  const errors = scored.map((r) => Math.abs(r.result.reps.length - r.groundTruth));
  return {
    videos: scored.length,
    mae: errors.reduce((a, b) => a + b, 0) / scored.length,
    exact: errors.filter((e) => e === 0).length / scored.length,
  };
}
