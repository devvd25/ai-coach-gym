/**
 * Every threshold of the squat counter lives here (AGENTS.md §6), so experiments change one file.
 * Angles are hip–knee–ankle in degrees: ~175° standing, ~90° at parallel depth.
 */
export interface CounterConfig {
  /** Landmarks below this MediaPipe visibility are ignored; the frame is not counted. */
  minVisibility: number;
  /** EMA weight of the newest angle (0–1). Lower = smoother but laggier. */
  emaAlpha: number;
  /** Smoothed angle at or below this enters the DOWN phase. */
  downAngle: number;
  /** Smoothed angle at or above this is standing; DOWN → UP here counts one rep. */
  upAngle: number;
  /** A DOWN → UP shorter than this is treated as jitter, not a rep. */
  minRepMs: number;
  /** If the body is not visible for longer than this, wait to see the user standing again. */
  maxGapMs: number;
}

export const COUNTER_CONFIG: CounterConfig = {
  minVisibility: 0.6,
  emaAlpha: 0.35,
  downAngle: 110,
  upAngle: 160,
  minRepMs: 600,
  maxGapMs: 1000,
};

export const POSE_MODELS = {
  lite: {
    label: 'Lite (nhanh)',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
  },
  full: {
    label: 'Full (chính xác hơn)',
    url: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task',
  },
} as const;

export type PoseModel = keyof typeof POSE_MODELS;

/** WASM runtime of the installed @mediapipe/tasks-vision version (keep in sync with package.json). */
export const MEDIAPIPE_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.1.1/wasm';

/** Frames per second sampled from an uploaded video in evaluation mode. */
export const EVAL_FPS_OPTIONS = [15, 30] as const;

/**
 * "Gentle" evaluation (on by default): rests between frames and between videos so a laptop does
 * not heat up during long batches. Counting results are identical; only the run takes longer.
 */
export const EVAL_GENTLE = { frameRestMs: 40, videoRestMs: 5000 } as const;
