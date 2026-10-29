import { describe, expect, it } from 'vitest';
import { COUNTER_CONFIG } from './config.js';
import { initialState } from './counter.js';
import { countingAccuracy, CSV_COLUMNS, evaluationCsv, type EvaluationRow } from './evaluation.js';

describe('evaluationCsv', () => {
  it('writes one row per video with rep timestamps and an empty ground-truth column', () => {
    const csv = evaluationCsv(
      [
        {
          video: 'squat, góc nghiêng "1".mp4',
          model: 'lite',
          fps: 15,
          durationSec: 21.456,
          processingSec: 12.34,
          result: {
            ...initialState,
            frames: 322,
            lowVisibilityFrames: 4,
            reps: [
              { timestampMs: 3210, minAngle: 88.44, durationMs: 1500 },
              { timestampMs: 6012, minAngle: 92.06, durationMs: 1400 },
            ],
          },
        },
      ],
      COUNTER_CONFIG,
    );
    const [header, row, end] = csv.split('\r\n');
    expect(header).toBe(CSV_COLUMNS.join(','));
    expect(row).toBe(
      '"squat, góc nghiêng ""1"".mp4",lite,15,21.46,322,4,2,3.21;6.01,88.4;92.1,,12.3,' +
        'down=110;up=160;ema=0.35;vis=0.6;minRepMs=600',
    );
    expect(end).toBe('');
  });
});

describe('countingAccuracy', () => {
  const row = (counted: number, groundTruth: number | null): EvaluationRow => ({
    video: 'v.mp4',
    model: 'lite',
    fps: 15,
    durationSec: 10,
    processingSec: 1,
    groundTruth,
    result: {
      ...initialState,
      reps: Array.from({ length: counted }, (_, i) => ({
        timestampMs: i,
        minAngle: 90,
        durationMs: 1000,
      })),
    },
  });

  it('scores only videos with a hand count', () => {
    expect(countingAccuracy([row(10, 10), row(8, 10), row(5, null)])).toEqual({
      videos: 2,
      mae: 1,
      normMae: 0.1,
      exact: 0.5,
      obo: 0.5,
    });
    // Off-by-one counts as right for OBO but not for exact match.
    expect(countingAccuracy([row(9, 10), row(4, 4)])).toMatchObject({ exact: 0.5, obo: 1 });
    expect(countingAccuracy([row(3, null)])).toBeNull();
  });
});
