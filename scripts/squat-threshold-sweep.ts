/**
 * Squat counter threshold sweep (AGENTS.md §6–7): replays recorded evaluation frames
 * (the "Tải dữ liệu frame (JSON)" button on the evaluation page) through the same pure counter
 * with different thresholds. No pose model, no browser: a sweep takes seconds.
 *
 *   pnpm squat:sweep -- ml/data/repcount/results/frames-repcount-lite-15fps.json
 *   pnpm squat:sweep -- <file.json> --down 100,110,120,130,140 --up 150,160
 *
 * Writes <file>-sweep.csv next to the input and prints the table.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { COUNTER_CONFIG, type CounterConfig } from '../apps/web/src/features/squat/config.js';
import { countReps } from '../apps/web/src/features/squat/counter.js';
import { countingAccuracy, type EvaluationRow } from '../apps/web/src/features/squat/evaluation.js';
import { replayFrames, type RecordedRun } from '../apps/web/src/features/squat/frames.js';

const { values, positionals } = parseArgs({
  // `pnpm squat:sweep -- …` forwards a literal "--", which would turn every option into a positional.
  args: process.argv.slice(2).filter((a) => a !== '--'),
  options: {
    down: { type: 'string', default: '100,110,120,130,140' },
    up: { type: 'string', default: '150,160' },
    /** Only videos with at most this share of low-visibility frames (0–1). */
    'max-low-vis': { type: 'string', default: '1' },
  },
  allowPositionals: true,
});

const input = positionals[0];
if (!input) throw new Error('Usage: pnpm squat:sweep -- <frames.json> [--down 100,110] [--up 160]');
const file = resolve(process.env.INIT_CWD ?? process.cwd(), input);
const run = JSON.parse(readFileSync(file, 'utf8')) as RecordedRun;
if (run.format !== 'ai-coach-squat-frames/1') throw new Error(`Unknown format in ${file}`);

const nums = (s: string) => s.split(',').map(Number).filter(Number.isFinite);
const maxLowVis = Number(values['max-low-vis']);
const videos = run.videos.map((v) => ({ v, frames: replayFrames(v) }));

const header = [
  'down',
  'up',
  'videos',
  'mae',
  'norm_mae',
  'obo',
  'exact',
  'under',
  'over',
  'counted',
  'truth',
];
const lines = [header.join(',')];
const table: Record<string, string | number>[] = [];

for (const down of nums(values.down)) {
  for (const up of nums(values.up)) {
    if (up <= down) continue;
    const cfg: CounterConfig = { ...COUNTER_CONFIG, downAngle: down, upAngle: up };
    const rows: EvaluationRow[] = [];
    for (const { v, frames } of videos) {
      const result = countReps(frames, cfg);
      if (result.lowVisibilityFrames / Math.max(1, result.frames) > maxLowVis) continue;
      rows.push({
        video: v.video,
        model: run.model,
        fps: run.fps,
        durationSec: 0,
        processingSec: 0,
        result,
        groundTruth: v.groundTruth,
      });
    }
    const acc = countingAccuracy(rows);
    if (!acc) continue;
    const scored = rows.filter((r) => r.groundTruth !== null);
    const under = scored.filter((r) => r.result.reps.length < r.groundTruth!).length;
    const over = scored.filter((r) => r.result.reps.length > r.groundTruth!).length;
    const counted = scored.reduce((s, r) => s + r.result.reps.length, 0);
    const truth = scored.reduce((s, r) => s + r.groundTruth!, 0);
    const row = {
      down,
      up,
      videos: acc.videos,
      mae: acc.mae.toFixed(2),
      norm_mae: acc.normMae?.toFixed(3) ?? '',
      obo: `${Math.round(acc.obo * 100)}%`,
      exact: `${Math.round(acc.exact * 100)}%`,
      under,
      over,
      counted,
      truth,
    };
    table.push(row);
    lines.push(header.map((h) => String(row[h as keyof typeof row]).replace('%', '')).join(','));
  }
}

console.table(table);
const out = file.replace(/\.json$/, '') + '-sweep.csv';
writeFileSync(out, lines.join('\n') + '\n', 'utf8');
console.log(`CSV: ${out}`);
