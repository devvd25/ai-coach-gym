import { COUNTER_CONFIG, type PoseModel } from './config.js';
import { initialState, step, type Frame } from './counter.js';
import type { EvaluationRow } from './evaluation.js';
import { detectPose, getLandmarker, nextTimeline } from './pose.js';

/*
 * Offline evaluation of one video file. Kept out of the React page so a long batch can also be
 * started from the console (e.g. to evaluate a public dataset) with exactly the same code.
 */

function waitFor(el: HTMLVideoElement, event: 'loadeddata' | 'seeked'): Promise<void> {
  return new Promise((resolve, reject) => {
    const done = () => {
      el.removeEventListener(event, done);
      el.removeEventListener('error', fail);
      resolve();
    };
    const fail = () => {
      el.removeEventListener(event, done);
      el.removeEventListener('error', fail);
      reject(new Error('Không đọc được video'));
    };
    el.addEventListener(event, done);
    el.addEventListener('error', fail);
  });
}

let timerWorker: Worker | null | undefined;
let nextId = 0;
const waiting = new Map<number, () => void>();

/**
 * A pause that is still short when the tab is in the background: browsers stretch page timers to
 * ≥ 1 s in hidden tabs, which would turn a 40 ms rest per frame into hours. Worker timers are not
 * stretched that way. Falls back to setTimeout if workers are unavailable.
 */
export function rest(ms: number): Promise<void> {
  if (timerWorker === undefined) {
    try {
      const code = 'onmessage = (e) => setTimeout(() => postMessage(e.data.id), e.data.ms);';
      timerWorker = new Worker(URL.createObjectURL(new Blob([code], { type: 'text/javascript' })));
      timerWorker.onmessage = (e: MessageEvent<number>) => {
        waiting.get(e.data)?.();
        waiting.delete(e.data);
      };
    } catch {
      timerWorker = null;
    }
  }
  const worker = timerWorker;
  if (!worker) return new Promise((r) => setTimeout(r, ms));
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    worker.postMessage({ id, ms });
  });
}

export interface AnalyzeOptions {
  model: PoseModel;
  fps: number;
  /** Rest after every frame (gentle mode), in ms. */
  frameRestMs: number;
  onProgress?: (fraction: number) => void;
  cancelled?: () => boolean;
  /**
   * Receives every counter input, so a run can be saved and replayed later with other thresholds
   * (countReps) without running the pose model again.
   */
  onFrame?: (frame: Frame) => void;
}

/**
 * Steps through the file frame by frame (seek, detect, count) instead of playing it, so the result
 * does not depend on how fast the machine is and is the same every run.
 */
export async function analyzeVideo(file: File, opts: AnalyzeOptions): Promise<EvaluationRow> {
  const started = performance.now();
  const landmarker = await getLandmarker(opts.model);
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const url = URL.createObjectURL(file);
  try {
    v.src = url;
    await waitFor(v, 'loadeddata');
    let duration = v.duration;
    if (!Number.isFinite(duration)) {
      // Files recorded by browsers (MediaRecorder WebM) often report Infinity until seeked to the end.
      v.currentTime = Number.MAX_SAFE_INTEGER;
      await waitFor(v, 'seeked');
      duration = v.duration;
      v.currentTime = 0;
      await waitFor(v, 'seeked');
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      throw new Error(`Không đọc được thời lượng của video ${file.name}`);
    }
    const aspect = v.videoWidth / v.videoHeight;
    const base = nextTimeline(landmarker);
    let state = initialState;
    for (let i = 0; i * (1 / opts.fps) < duration; i++) {
      if (opts.cancelled?.()) throw new Error('Đã hủy');
      const t = i / opts.fps;
      if (Math.abs(v.currentTime - t) > 1e-6) {
        v.currentTime = t;
        await waitFor(v, 'seeked');
      }
      const landmarks = detectPose(landmarker, v, base + t * 1000);
      const frame: Frame = { timestampMs: t * 1000, landmarks, aspect };
      opts.onFrame?.(frame);
      state = step(state, frame, COUNTER_CONFIG);
      if (i % 5 === 0) opts.onProgress?.(t / duration);
      if (opts.frameRestMs) await rest(opts.frameRestMs);
    }
    opts.onProgress?.(1);
    return {
      video: file.name,
      model: opts.model,
      fps: opts.fps,
      durationSec: duration,
      processingSec: (performance.now() - started) / 1000,
      result: state,
      groundTruth: null,
    };
  } finally {
    URL.revokeObjectURL(url);
    v.removeAttribute('src');
  }
}
