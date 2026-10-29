import { LEG_LANDMARKS, type Frame, type Point } from './counter.js';

/**
 * Saved counter input of an evaluation run, so thresholds can be re-tested offline
 * (scripts/squat-threshold-sweep.ts) without running the pose model again. Only the six leg
 * landmarks the counter reads are kept, rounded to 4 decimals: ~10 KB per minute of video.
 */
export interface RecordedVideo {
  video: string;
  groundTruth: number | null;
  aspect: number;
  /** Frame times in ms. */
  t: number[];
  /** Per frame: [x, y, visibility] × (left hip, knee, ankle, right hip, knee, ankle), or null. */
  legs: (number[] | null)[];
}

export interface RecordedRun {
  format: 'ai-coach-squat-frames/1';
  model: string;
  fps: number;
  createdAt: string;
  videos: RecordedVideo[];
}

const LEG_INDICES = [...LEG_LANDMARKS.left, ...LEG_LANDMARKS.right];
const r4 = (n: number) => Math.round(n * 1e4) / 1e4;

export function recordFrame(target: RecordedVideo, frame: Frame): void {
  target.t.push(Math.round(frame.timestampMs));
  const lm = frame.landmarks;
  target.legs.push(
    lm
      ? LEG_INDICES.flatMap((i) => {
          const p = lm[i];
          return p ? [r4(p.x), r4(p.y), r4(p.visibility ?? 0)] : [0, 0, 0];
        })
      : null,
  );
}

/** Rebuilds the frames the counter saw (other landmarks are left empty; the counter ignores them). */
export function replayFrames(v: RecordedVideo): Frame[] {
  return v.t.map((timestampMs, i) => {
    const flat = v.legs[i];
    if (!flat) return { timestampMs, landmarks: null, aspect: v.aspect };
    const landmarks: Point[] = [];
    LEG_INDICES.forEach((idx, k) => {
      landmarks[idx] = { x: flat[k * 3]!, y: flat[k * 3 + 1]!, visibility: flat[k * 3 + 2]! };
    });
    return { timestampMs, landmarks, aspect: v.aspect };
  });
}
