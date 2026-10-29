import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { runStructured, type AiLogEntry, type LlmClient, type LlmMessage } from './llm.service.js';

const schema = z.object({ kcal: z.number().int() });
type Out = z.infer<typeof schema>;

/** Answers with the given replies in order; an Error reply is thrown instead. */
function fakeLlm(replies: (string | Error)[]) {
  const seen: LlmMessage[][] = [];
  const client: LlmClient = {
    model: 'fake',
    async chat({ messages }) {
      seen.push([...messages]);
      const next = replies.shift();
      if (next === undefined) throw new Error('no more replies');
      if (next instanceof Error) throw next;
      return { content: next, outputTokens: 5 };
    },
  };
  return { client, seen };
}

function run(replies: (string | Error)[], check: (o: Out) => string[] = () => []) {
  const { client, seen } = fakeLlm(replies);
  const logged: AiLogEntry[] = [];
  const result = runStructured(
    client,
    async (e) => {
      logged.push(e);
      return 42;
    },
    {
      userId: 7,
      task: 'nutrition',
      promptVersion: 'nutrition.v1',
      messages: [{ role: 'user', content: 'hỏi' }],
      schema,
      check,
      fallback: () => ({ kcal: 2000 }),
    },
  );
  return { result, seen, logged };
}

const atLeast1500 = (o: Out) => (o.kcal < 1500 ? ['Calo quá thấp'] : []);

describe('runStructured', () => {
  it('accepts a valid first answer without retrying', async () => {
    const { result, seen, logged } = run(['{"kcal":2100}'], atLeast1500);
    const { data, meta } = await result;
    expect(data).toEqual({ kcal: 2100 });
    expect(seen).toHaveLength(1);
    expect(meta).toMatchObject({
      requestId: 42,
      schemaValid: true,
      retryCount: 0,
      violations: [],
      usedFallback: false,
    });
    expect(logged[0]).toMatchObject({ userId: 7, task: 'nutrition', model: 'fake', error: null });
  });

  it('retries once with the errors fed back when the JSON does not match the schema', async () => {
    const { result, seen } = run(['{"kcal":"nhiều"}', '{"kcal":1900}']);
    const { data, meta } = await result;
    expect(data).toEqual({ kcal: 1900 });
    expect(meta).toMatchObject({ schemaValid: false, retryCount: 1, usedFallback: false });
    const feedback = seen[1]!.at(-1)!;
    expect(feedback.role).toBe('user');
    expect(feedback.content).toContain('kcal');
    expect(seen[1]!.at(-2)).toEqual({ role: 'assistant', content: '{"kcal":"nhiều"}' });
  });

  it('falls back to the template when safety rules fail twice', async () => {
    const { result, seen } = run(['{"kcal":900}', '{"kcal":1000}'], atLeast1500);
    const { data, meta } = await result;
    expect(seen).toHaveLength(2);
    expect(seen[1]!.at(-1)!.content).toContain('Calo quá thấp');
    expect(data).toEqual({ kcal: 2000 });
    expect(meta).toMatchObject({
      schemaValid: true,
      retryCount: 1,
      violations: ['Calo quá thấp'],
      usedFallback: true,
    });
  });

  it('falls back immediately on a timeout, without a second call', async () => {
    const timeout = Object.assign(new Error('timed out'), { name: 'TimeoutError' });
    const { result, seen, logged } = run([timeout, '{"kcal":2100}']);
    const { data, meta } = await result;
    expect(seen).toHaveLength(1);
    expect(data).toEqual({ kcal: 2000 });
    expect(meta).toMatchObject({ schemaValid: false, retryCount: 0, usedFallback: true });
    expect(logged[0]!.error).toBe('Hết thời gian chờ Ollama');
  });

  it('treats non-JSON output as a schema failure', async () => {
    const { result } = run(['Xin chào!', 'vẫn không phải JSON']);
    const { meta } = await result;
    expect(meta).toMatchObject({ schemaValid: false, retryCount: 1, usedFallback: true });
  });
});
