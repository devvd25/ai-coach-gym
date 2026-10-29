import type { CounterConfig } from './config.js';

/**
 * Squat rep counting as pure functions (no DOM, no MediaPipe), so it can be unit-tested with
 * synthetic landmarks and reused by the live camera and the offline evaluation mode.
 */

/** A MediaPipe normalized landmark: x, y in 0–1 of the image width/height. */
export interface Point {
  x: number;
  y: number;
  visibility?: number;
}

export interface Frame {
  timestampMs: number;
  /** The 33 pose landmarks, or null when no person was detected. */
  landmarks: readonly Point[] | null;
  /** Image width / height; normalized x and y use different units, so angles need it. */
  aspect: number;
}

export type Side = 'left' | 'right';
export type Phase = 'waiting' | 'up' | 'down';

export interface Rep {
  /** When the user was back up (the moment the rep is counted). */
  timestampMs: number;
  /** Smallest smoothed knee angle during the rep = depth. */
  minAngle: number;
  durationMs: number;
}

export interface CounterState {
  phase: Phase;
  reps: Rep[];
  /** Smoothed (EMA) knee angle, null until the body has been seen. */
  angle: number | null;
  side: Side | null;
  visible: boolean;
  downSinceMs: number | null;
  minAngle: number | null;
  lastSeenMs: number | null;
  frames: number;
  lowVisibilityFrames: number;
}

/** MediaPipe Pose indices: [hip, knee, ankle]. */
export const LEG_LANDMARKS: Record<Side, readonly [number, number, number]> = {
  left: [23, 25, 27],
  right: [24, 26, 28],
};

export const initialState: CounterState = {
  phase: 'waiting',
  reps: [],
  angle: null,
  side: null,
  visible: false,
  downSinceMs: null,
  minAngle: null,
  lastSeenMs: null,
  frames: 0,
  lowVisibilityFrames: 0,
};

/** Angle at b (degrees) between b→a and b→c, with x scaled to the same unit as y. */
export function jointAngle(a: Point, b: Point, c: Point, aspect = 1): number {
  const ux = (a.x - b.x) * aspect;
  const uy = a.y - b.y;
  const vx = (c.x - b.x) * aspect;
  const vy = c.y - b.y;
  const len = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (len === 0) return 180;
  const cos = Math.min(1, Math.max(-1, (ux * vx + uy * vy) / len));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** The leg facing the camera: the side whose weakest of hip/knee/ankle is most visible. */
export function pickSide(landmarks: readonly Point[]): { side: Side; visibility: number } | null {
  let best: { side: Side; visibility: number } | null = null;
  for (const side of ['left', 'right'] as const) {
    const points = LEG_LANDMARKS[side].map((i) => landmarks[i]);
    if (points.some((p) => !p)) continue;
    const visibility = Math.min(...points.map((p) => p?.visibility ?? 0));
    if (!best || visibility > best.visibility) best = { side, visibility };
  }
  return best;
}

export function kneeAngle(landmarks: readonly Point[], side: Side, aspect: number): number {
  const [hip, knee, ankle] = LEG_LANDMARKS[side].map((i) => landmarks[i]!) as [Point, Point, Point];
  return jointAngle(hip, knee, ankle, aspect);
}

/** One frame of the UP → DOWN → UP state machine with hysteresis. */
export function step(state: CounterState, frame: Frame, cfg: CounterConfig): CounterState {
  const frames = state.frames + 1;
  const picked = frame.landmarks ? pickSide(frame.landmarks) : null;

  if (!frame.landmarks || !picked || picked.visibility < cfg.minVisibility) {
    const lost = state.lastSeenMs !== null && frame.timestampMs - state.lastSeenMs > cfg.maxGapMs;
    return {
      ...state,
      ...(lost ? { phase: 'waiting', angle: null, downSinceMs: null, minAngle: null } : {}),
      visible: false,
      frames,
      lowVisibilityFrames: state.lowVisibilityFrames + 1,
    };
  }

  const raw = kneeAngle(frame.landmarks, picked.side, frame.aspect);
  const angle = state.angle === null ? raw : cfg.emaAlpha * raw + (1 - cfg.emaAlpha) * state.angle;
  const next: CounterState = {
    ...state,
    angle,
    side: picked.side,
    visible: true,
    lastSeenMs: frame.timestampMs,
    frames,
  };

  switch (state.phase) {
    case 'waiting':
      // Counting starts only after the user has been seen standing.
      if (angle >= cfg.upAngle) next.phase = 'up';
      break;
    case 'up':
      if (angle <= cfg.downAngle) {
        next.phase = 'down';
        next.downSinceMs = frame.timestampMs;
        next.minAngle = angle;
      }
      break;
    case 'down':
      next.minAngle = Math.min(state.minAngle ?? angle, angle);
      if (angle >= cfg.upAngle) {
        const durationMs = frame.timestampMs - (state.downSinceMs ?? frame.timestampMs);
        next.phase = 'up';
        next.downSinceMs = null;
        if (durationMs >= cfg.minRepMs) {
          next.reps = [
            ...state.reps,
            { timestampMs: frame.timestampMs, minAngle: next.minAngle, durationMs },
          ];
        }
        next.minAngle = null;
      }
      break;
  }
  return next;
}

/** Runs a whole recorded sequence through the counter (evaluation mode and tests). */
export function countReps(frames: Iterable<Frame>, cfg: CounterConfig): CounterState {
  let state = initialState;
  for (const f of frames) state = step(state, f, cfg);
  return state;
}

export function averageMinAngle(reps: readonly Rep[]): number | null {
  if (reps.length === 0) return null;
  return Math.round((reps.reduce((s, r) => s + r.minAngle, 0) / reps.length) * 10) / 10;
}
