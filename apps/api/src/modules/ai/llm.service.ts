import type { AiMeta, AiTask } from '@ai-coach/shared';
import { Ollama } from 'ollama';
import { z } from 'zod';

export interface LlmMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LlmClient {
  readonly model: string;
  /** Returns the raw JSON text produced under the given JSON Schema. */
  chat(req: {
    messages: LlmMessage[];
    jsonSchema: object;
    temperature: number;
  }): Promise<{ content: string; outputTokens: number | null }>;
}

/** The only place that talks to Ollama (AGENTS.md §5). */
export function createOllamaClient(opts: {
  host: string;
  model: string;
  think: boolean;
  timeoutMs: number;
}): LlmClient {
  // A fetch with a deadline per request, so one slow generation cannot hang the API.
  const ollama = new Ollama({
    host: opts.host,
    fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(opts.timeoutMs) }),
  });
  return {
    model: opts.model,
    async chat({ messages, jsonSchema, temperature }) {
      const res = await ollama.chat({
        model: opts.model,
        messages,
        format: jsonSchema,
        think: opts.think,
        stream: false,
        keep_alive: '10m',
        options: { temperature, num_ctx: 8192 },
      });
      return { content: res.message.content, outputTokens: res.eval_count ?? null };
    },
  };
}

export interface AiLogEntry {
  userId: number;
  task: AiTask;
  model: string;
  promptVersion: string;
  latencyMs: number;
  schemaValid: boolean;
  retryCount: number;
  violations: string[];
  usedFallback: boolean;
  outputTokens: number | null;
  error: string | null;
}

export type AiLogger = (entry: AiLogEntry) => Promise<number>;

export interface StructuredTask<T> {
  userId: number;
  task: AiTask;
  promptVersion: string;
  messages: LlmMessage[];
  schema: z.ZodType<T>;
  temperature?: number;
  /** Safety rules: empty list means the output may be used. */
  check(output: T): string[];
  /** Deterministic, rule-checked answer used when the model fails twice. */
  fallback(): T;
}

export interface StructuredResult<T> {
  data: T;
  meta: AiMeta;
}

function describeSchemaError(err: z.ZodError): string[] {
  return err.issues.slice(0, 8).map((i) => `${i.path.join('.') || 'gốc'}: ${i.message}`);
}

/**
 * Ask → parse JSON → validate with Zod → safety rules. On failure retry once with the errors fed
 * back to the model; if it still fails, use the fallback. Every call is logged to ai_requests.
 */
export async function runStructured<T>(
  llm: LlmClient,
  log: AiLogger,
  t: StructuredTask<T>,
): Promise<StructuredResult<T>> {
  const started = performance.now();
  const jsonSchema = z.toJSONSchema(t.schema);
  const messages = [...t.messages];
  let schemaValid = false;
  let violations: string[] = [];
  let outputTokens: number | null = null;
  let error: string | null = null;
  let attempt = 0;
  let accepted: T | null = null;

  for (; attempt < 2 && accepted === null; attempt++) {
    let content: string;
    try {
      const res = await llm.chat({ messages, jsonSchema, temperature: t.temperature ?? 0.3 });
      content = res.content;
      outputTokens = (outputTokens ?? 0) + (res.outputTokens ?? 0);
    } catch (err) {
      // Timeouts and connection errors will not be fixed by asking again.
      error =
        err instanceof Error && err.name === 'TimeoutError'
          ? 'Hết thời gian chờ Ollama'
          : 'Không kết nối được Ollama';
      break;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(content);
    } catch {
      parsed = undefined;
    }
    const result = t.schema.safeParse(parsed);
    if (attempt === 0) schemaValid = result.success;

    const problems = result.success ? t.check(result.data) : describeSchemaError(result.error);
    if (result.success) violations = problems;
    if (problems.length === 0 && result.success) {
      accepted = result.data;
      break;
    }
    messages.push(
      { role: 'assistant', content },
      {
        role: 'user',
        content: `Kết quả chưa hợp lệ:\n- ${problems.join('\n- ')}\nHãy trả lại TOÀN BỘ JSON đã sửa, đúng schema và đúng các quy tắc.`,
      },
    );
  }

  const usedFallback = accepted === null;
  const data = accepted ?? t.fallback();
  const entry: AiLogEntry = {
    userId: t.userId,
    task: t.task,
    model: llm.model,
    promptVersion: t.promptVersion,
    latencyMs: Math.round(performance.now() - started),
    schemaValid,
    retryCount: Math.min(attempt, 1),
    violations,
    usedFallback,
    outputTokens,
    error,
  };
  const requestId = await log(entry);
  return {
    data,
    meta: {
      requestId,
      model: entry.model,
      promptVersion: entry.promptVersion,
      latencyMs: entry.latencyMs,
      schemaValid,
      retryCount: entry.retryCount,
      violations,
      usedFallback,
    },
  };
}
