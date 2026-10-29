import { describe, expect, it } from 'vitest';
import { COUNTER_CONFIG } from './config.js';
import { countReps, type Frame, type Point } from './counter.js';
import { recordFrame, replayFrames, type RecordedVideo } from './frames.js';

/** Side-on pose with the left knee at `angle` degrees (as in counter.test.ts). */
function pose(angle: number): Point[] {
  const points: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const rad = (angle * Math.PI) / 180;
  points[23] = { x: 0.5, y: 0.4, visibility: 0.95 };
  points[25] = { x: 0.5, y: 0.6, visibility: 0.95 };
  points[27] = {
    x: 0.5 + (0.2 * Math.sin(rad)) / 1.6,
    y: 0.6 - 0.2 * Math.cos(rad),
    visibility: 0.95,
  };
  return points;
}

const squat = Array.from({ length: 48 }, (_, i) => 175 - 90 * Math.sin((Math.PI * i) / 47));
const angles = [...Array<number>(15).fill(175), ...squat, ...squat, ...Array<number>(15).fill(175)];
const frames: Frame[] = angles.map((a, i) => ({
  timestampMs: Math.round((i * 1000) / 30),
  landmarks: i === 20 ? null : pose(a),
  aspect: 1.6,
}));

describe('recorded frames', () => {
  const rec: RecordedVideo = { video: 'v.mp4', groundTruth: 2, aspect: 1.6, t: [], legs: [] };
  frames.forEach((f) => recordFrame(rec, f));

  it('keeps only the six leg landmarks, compactly', () => {
    expect(rec.t).toHaveLength(frames.length);
    expect(rec.legs[0]).toHaveLength(18);
    expect(rec.legs[20]).toBeNull();
    expect(JSON.stringify(rec).length).toBeLessThan(frames.length * 140);
  });

  it('replays to the same count as the live run, so thresholds can be re-tested offline', () => {
    const live = countReps(frames, COUNTER_CONFIG);
    const replayed = countReps(replayFrames(rec), COUNTER_CONFIG);
    expect(live.reps).toHaveLength(2);
    expect(replayed.reps.map((r) => r.timestampMs)).toEqual(live.reps.map((r) => r.timestampMs));
    expect(replayed.lowVisibilityFrames).toBe(live.lowVisibilityFrames);
    // A stricter depth threshold changes the result without re-running the pose model.
    expect(countReps(replayFrames(rec), { ...COUNTER_CONFIG, downAngle: 80 }).reps).toHaveLength(0);
  });
});
