import { describe, expect, it } from 'vitest';
import { healthResponseSchema, overallStatus, type HealthChecks } from './health.js';

const healthy: HealthChecks = {
  database: { ok: true, latencyMs: 4 },
  ollama: { ok: true, latencyMs: 12, model: 'qwen3:4b', modelAvailable: true },
};

describe('overallStatus', () => {
  it('is ok when database and ollama model are available', () => {
    expect(overallStatus(healthy)).toBe('ok');
  });

  it('is degraded when the database is down', () => {
    expect(
      overallStatus({ ...healthy, database: { ok: false, latencyMs: null, error: 'down' } }),
    ).toBe('degraded');
  });

  it('is degraded when ollama runs but the model is not pulled', () => {
    expect(
      overallStatus({ ...healthy, ollama: { ...healthy.ollama, modelAvailable: false } }),
    ).toBe('degraded');
  });
});

describe('healthResponseSchema', () => {
  it('accepts a valid payload and rejects a bad timestamp', () => {
    const payload = {
      status: 'ok',
      version: '0.1.0',
      time: new Date().toISOString(),
      checks: healthy,
    };
    expect(healthResponseSchema.parse(payload)).toEqual(payload);
    expect(healthResponseSchema.safeParse({ ...payload, time: 'yesterday' }).success).toBe(false);
  });
});
