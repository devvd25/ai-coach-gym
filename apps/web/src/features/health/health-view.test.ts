import type { HealthResponse } from '@ai-coach/shared';
import { describe, expect, it } from 'vitest';
import { toServiceRows } from './health-view.js';

const health: HealthResponse = {
  status: 'degraded',
  version: '0.1.0',
  time: new Date().toISOString(),
  checks: {
    database: { ok: true, latencyMs: 7 },
    ollama: {
      ok: true,
      latencyMs: 15,
      model: 'qwen3:4b',
      modelAvailable: false,
      error: 'Chưa có model qwen3:4b, hãy chạy: ollama pull qwen3:4b',
    },
  },
};

describe('toServiceRows', () => {
  it('marks every row as failing when the API is unreachable', () => {
    const rows = toServiceRows(undefined, false);
    expect(rows.map((r) => r.ok)).toEqual([false, false, false]);
    expect(rows[0]?.detail).toContain('pnpm dev');
  });

  it('shows latency and treats a missing model as not ready', () => {
    const rows = toServiceRows(health, true);
    expect(rows[1]).toMatchObject({ ok: true, latency: '7 ms' });
    expect(rows[2]).toMatchObject({ ok: false, latency: '15 ms' });
    expect(rows[2]?.detail).toContain('ollama pull');
  });
});
