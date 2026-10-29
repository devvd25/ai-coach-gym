/**
 * LLM benchmark (AGENTS.md §7): runs the fixture profiles through the same prompt, JSON schema,
 * safety rules, retry and fallback as the API, for each model given, and writes one CSV row per
 * call. No database is needed; Ollama must be running.
 *
 *   pnpm benchmark:llm -- --models qwen3:4b,qwen3:8b --tasks plan,nutrition --runs 1 --save-output
 *
 * Options
 *   --models    comma list (default: OLLAMA_MODEL or qwen3:4b)
 *   --tasks     plan,nutrition (default: both)
 *   --profiles  comma list of ids such as p01,p07 (default: all 30)
 *   --runs      repetitions per profile, to measure variance (default: 1)
 *   --think     turn qwen3 thinking on (default: off, as in the app)
 *   --save-output  also write the accepted JSON of each call to a .jsonl file for rubric scoring
 *   --out       output folder (default: scripts/results)
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { profileSchema, type Profile } from '@ai-coach/shared';
import { SEEDED_LIBRARY } from '../apps/api/src/db/seed-library.js';
import {
  createOllamaClient,
  RETRY_PREFIX,
  runStructured,
  type StructuredTask,
} from '../apps/api/src/modules/ai/llm.service.js';
import { nutritionTask, planTask } from '../apps/api/src/modules/ai/tasks.js';

const here = dirname(fileURLToPath(import.meta.url));
const rootEnv = join(here, '..', '.env');
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const { values } = parseArgs({
  options: {
    models: { type: 'string', default: process.env.OLLAMA_MODEL ?? 'qwen3:4b' },
    tasks: { type: 'string', default: 'plan,nutrition' },
    profiles: { type: 'string', default: 'all' },
    runs: { type: 'string', default: '1' },
    think: { type: 'boolean', default: false },
    'save-output': { type: 'boolean', default: false },
    out: { type: 'string', default: join(here, 'results') },
  },
  allowPositionals: true,
});

const TASKS = ['plan', 'nutrition'] as const;
type Task = (typeof TASKS)[number];

const models = values.models
  .split(',')
  .map((m) => m.trim())
  .filter(Boolean);
const tasks = values.tasks.split(',').map((t) => t.trim()) as Task[];
const runs = Math.max(1, Number.parseInt(values.runs, 10) || 1);
for (const t of tasks) {
  if (!TASKS.includes(t)) throw new Error(`Unknown task "${t}" (use ${TASKS.join(', ')})`);
}

interface Fixture {
  id: string;
  description: string;
  profile: Profile;
}

const fixtureDir = join(here, 'fixtures', 'profiles');
const fixtures: Fixture[] = readdirSync(fixtureDir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => {
    const raw = JSON.parse(readFileSync(join(fixtureDir, f), 'utf8')) as Fixture;
    return { ...raw, profile: profileSchema.parse(raw.profile) };
  })
  .filter((f) => values.profiles === 'all' || values.profiles.split(',').includes(f.id));
if (fixtures.length === 0) throw new Error('No profiles selected');

const COLUMNS = [
  'model',
  'task',
  'profile_id',
  'run',
  'prompt_version',
  'latency_ms',
  'schema_valid',
  'retry_count',
  'violations_count',
  'violations_first_attempt',
  'used_fallback',
  'output_tokens',
  'error',
  'violations',
] as const;

const cell = (v: string | number | boolean | null) => {
  const s = v === null ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
};

function taskFor(task: Task, profile: Profile): StructuredTask<unknown> {
  return (
    task === 'plan' ? planTask(0, profile, SEEDED_LIBRARY) : nutritionTask(0, profile)
  ) as StructuredTask<unknown>;
}

async function main() {
  mkdirSync(values.out, { recursive: true });
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
  const csvPath = join(values.out, `llm-benchmark-${stamp}.csv`);
  const jsonlPath = join(values.out, `llm-outputs-${stamp}.jsonl`);
  const rows: string[] = [COLUMNS.join(',')];
  const outputs: string[] = [];
  const host = process.env.OLLAMA_HOST ?? 'http://127.0.0.1:11434';
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS ?? 120_000);
  const total = models.length * tasks.length * fixtures.length * runs;
  let n = 0;

  for (const model of models) {
    const llm = createOllamaClient({ host, model, think: values.think, timeoutMs });
    for (const task of tasks) {
      for (const f of fixtures) {
        for (let run = 1; run <= runs; run++) {
          n++;
          let tokens: number | null = null;
          let error: string | null = null;
          const { data, meta } = await runStructured(
            llm,
            async (entry) => {
              tokens = entry.outputTokens;
              error = entry.error;
              return n;
            },
            taskFor(task, f.profile),
          );
          const first = meta.violations.filter((v) => !v.startsWith(RETRY_PREFIX)).length;
          rows.push(
            [
              model,
              task,
              f.id,
              run,
              meta.promptVersion,
              meta.latencyMs,
              meta.schemaValid,
              meta.retryCount,
              meta.violations.length,
              first,
              meta.usedFallback,
              tokens,
              error,
              meta.violations.join(' | '),
            ]
              .map(cell)
              .join(','),
          );
          if (values['save-output']) {
            outputs.push(
              JSON.stringify({
                model,
                task,
                profile_id: f.id,
                run,
                used_fallback: meta.usedFallback,
                output: data,
              }),
            );
          }
          console.log(
            `[${n}/${total}] ${model} ${task} ${f.id} run ${run}: ${meta.latencyMs} ms` +
              `${meta.retryCount ? ', retried' : ''}${meta.usedFallback ? ', FALLBACK' : ''}` +
              `${error ? ` (${error})` : ''}`,
          );
          // Written after every call so a long run that is interrupted still leaves results.
          writeFileSync(csvPath, rows.join('\r\n') + '\r\n', 'utf8');
          if (values['save-output']) writeFileSync(jsonlPath, outputs.join('\n') + '\n', 'utf8');
        }
      }
    }
  }
  console.log(`\nCSV: ${csvPath}${values['save-output'] ? `\nOutputs: ${jsonlPath}` : ''}`);
}

await main();
