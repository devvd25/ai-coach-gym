import { describe, expect, it } from 'vitest';
import { COUNTER_CONFIG } from './config.js';
import {
  averageMinAngle,
  countReps,
  jointAngle,
  pickSide,
  type Frame,
  type Point,
  type Side,
} from './counter.js';

const ASPECT = 16 / 9;

/**
 * 33 landmarks of a side-on person whose knee is bent to `angle` degrees. The visible leg has
 * visibility `vis`, the far leg 0.3 (hidden behind the body, as MediaPipe reports it).
 */
function pose(angle: number, opts: { side?: Side; vis?: number; aspect?: number } = {}): Point[] {
  const side = opts.side ?? 'left';
  const vis = opts.vis ?? 0.95;
  const aspect = opts.aspect ?? ASPECT;
  const points: Point[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.3 }));
  const knee = { x: 0.5, y: 0.6 };
  const len = 0.2;
  const rad = (angle * Math.PI) / 180;
  // Thigh straight up from the knee; shin rotated by `angle` from the thigh. x is divided by the
  // aspect ratio because MediaPipe x is a fraction of the (wider) width.
  const hip = { x: knee.x, y: knee.y - len };
  const ankle = { x: knee.x + (len * Math.sin(rad)) / aspect, y: knee.y - len * Math.cos(rad) };
  const [h, k, a] = side === 'left' ? [23, 25, 27] : [24, 26, 28];
  points[h] = { ...hip, visibility: vis };
  points[k] = { ...knee, visibility: vis };
  points[a] = { ...ankle, visibility: vis };
  return points;
}

/** Frames at 30 fps following a list of knee angles. */
function frames(angles: number[], opts: Parameters<typeof pose>[1] = {}, startMs = 0): Frame[] {
  return angles.map((angle, i) => ({
    timestampMs: startMs + Math.round((i * 1000) / 30),
    landmarks: pose(angle, opts),
    aspect: opts.aspect ?? ASPECT,
  }));
}

/** Smooth 1.6 s squat: 175° → bottom → 175°. */
function squat(bottom = 85, n = 48): number[] {
  return Array.from({ length: n }, (_, i) => {
    const t = Math.sin((Math.PI * i) / (n - 1));
    return 175 - (175 - bottom) * t;
  });
}

const stand = (n = 15) => Array<number>(n).fill(175);

describe('geometry', () => {
  it('computes the knee angle independent of the image aspect ratio', () => {
    for (const a of [60, 90, 135, 175]) {
      const p = pose(a);
      expect(jointAngle(p[23]!, p[25]!, p[27]!, ASPECT)).toBeCloseTo(a, 5);
    }
    // Ignoring the aspect ratio would give a wrong angle.
    const p = pose(135);
    expect(Math.abs(jointAngle(p[23]!, p[25]!, p[27]!, 1) - 135)).toBeGreaterThan(10);
  });

  it('uses the leg facing the camera', () => {
    expect(pickSide(pose(120, { side: 'right' }))?.side).toBe('right');
    expect(pickSide(pose(120, { side: 'left' }))?.side).toBe('left');
  });
});

describe('countReps', () => {
  it('counts three clean squats with their depth', () => {
    const s = countReps(
      frames([
        ...stand(),
        ...squat(),
        ...stand(),
        ...squat(90),
        ...stand(),
        ...squat(95),
        ...stand(),
      ]),
      COUNTER_CONFIG,
    );
    expect(s.reps).toHaveLength(3);
    expect(s.phase).toBe('up');
    // EMA lags, so the recorded bottom is a little above the true one.
    for (const [r, bottom] of s.reps.map((r, i) => [r, [85, 90, 95][i]!] as const)) {
      expect(r.minAngle).toBeGreaterThanOrEqual(bottom);
      expect(r.minAngle).toBeLessThan(bottom + 10);
    }
    expect(averageMinAngle(s.reps)).toBeGreaterThan(85);
  });

  it('does not count partial squats that never reach the DOWN threshold', () => {
    const s = countReps(
      frames([...stand(), ...squat(130), ...stand(), ...squat(125)]),
      COUNTER_CONFIG,
    );
    expect(s.reps).toHaveLength(0);
  });

  it('does not double count bounces between the two thresholds (hysteresis)', () => {
    // Down to the bottom, then bounces 95° ↔ 145° three times (crossing downAngle each time but
    // never reaching upAngle), then stands up once.
    const bounce = [95, 110, 130, 145, 130, 110, 95];
    const s = countReps(
      frames([
        ...stand(),
        ...squat(90).slice(0, 24),
        ...bounce,
        ...bounce,
        ...bounce,
        ...squat(90).slice(24),
        ...stand(),
      ]),
      COUNTER_CONFIG,
    );
    expect(s.reps).toHaveLength(1);
    // A single threshold at 110° would have seen 4 "reps" in the same signal.
  });

  it('ignores a bounce shorter than minRepMs', () => {
    // 175 → 90 → 175 in 8 frames (~0.27 s): physically not a squat, a detection glitch.
    const glitch = [175, 140, 100, 90, 90, 110, 160, 175];
    const s = countReps(frames([...stand(), ...glitch, ...stand()]), COUNTER_CONFIG);
    expect(s.reps).toHaveLength(0);
  });

  it('starts counting only after the user is seen standing', () => {
    // The recording starts at the bottom of a squat.
    const s = countReps(
      frames([...squat().slice(24), ...stand(), ...squat(), ...stand()]),
      COUNTER_CONFIG,
    );
    expect(s.reps).toHaveLength(1);
  });

  it('skips low-visibility frames and resets after the body leaves the frame', () => {
    const seq = [
      ...frames([...stand(), ...squat().slice(0, 24)]), // goes down…
      ...frames(Array<number>(45).fill(90), { vis: 0.2 }, 1300), // …then is hidden for 1.5 s
      ...frames([...squat().slice(24), ...stand(), ...squat(), ...stand()], {}, 2800),
    ];
    const s = countReps(seq, COUNTER_CONFIG);
    expect(s.lowVisibilityFrames).toBe(45);
    // The interrupted rep is dropped; only the full one after returning counts.
    expect(s.reps).toHaveLength(1);
  });

  it('frames without a detected person count as low visibility', () => {
    const empty: Frame[] = [0, 33, 66].map((t) => ({ timestampMs: t, landmarks: null, aspect: 1 }));
    const s = countReps(empty, COUNTER_CONFIG);
    expect(s).toMatchObject({ frames: 3, lowVisibilityFrames: 3, visible: false, reps: [] });
  });

  it('works with the right leg and a portrait camera', () => {
    const opts = { side: 'right' as const, aspect: 9 / 16 };
    const s = countReps(
      frames([...stand(), ...squat(), ...stand(), ...squat(), ...stand()], opts),
      COUNTER_CONFIG,
    );
    expect(s.reps).toHaveLength(2);
    expect(s.side).toBe('right');
  });
});
