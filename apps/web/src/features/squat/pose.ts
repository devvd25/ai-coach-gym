import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';
import { MEDIAPIPE_WASM, POSE_MODELS, type PoseModel } from './config.js';
import type { Point } from './counter.js';

let fileset: ReturnType<typeof FilesetResolver.forVisionTasks> | null = null;
const landmarkers = new Map<PoseModel, Promise<PoseLandmarker>>();
const lastTimestamp = new WeakMap<PoseLandmarker, number>();

async function create(model: PoseModel, delegate: 'GPU' | 'CPU') {
  fileset ??= FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
  return PoseLandmarker.createFromOptions(await fileset, {
    baseOptions: { modelAssetPath: POSE_MODELS[model].url, delegate },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
}

/** One landmarker per model, created on first use (downloads ~5–10 MB the first time). */
export function getLandmarker(model: PoseModel): Promise<PoseLandmarker> {
  let p = landmarkers.get(model);
  if (!p) {
    // WebGL is much faster; some machines/browsers refuse it, then fall back to CPU.
    p = create(model, 'GPU').catch(() => create(model, 'CPU'));
    p.catch(() => landmarkers.delete(model));
    landmarkers.set(model, p);
  }
  return p;
}

/**
 * Pose landmarks of the frame currently shown by `source`, or null if no person was found.
 * VIDEO mode requires strictly increasing timestamps, so they are bumped when needed.
 */
export function detectPose(
  landmarker: PoseLandmarker,
  source: HTMLVideoElement,
  timestampMs: number,
): Point[] | null {
  const ts = Math.max(Math.round(timestampMs), (lastTimestamp.get(landmarker) ?? -1) + 1);
  lastTimestamp.set(landmarker, ts);
  const result = landmarker.detectForVideo(source, ts);
  return result.landmarks[0] ?? null;
}

/** A timestamp safely after everything this landmarker has seen; each new video starts there. */
export function nextTimeline(landmarker: PoseLandmarker): number {
  return (lastTimestamp.get(landmarker) ?? 0) + 1000;
}
