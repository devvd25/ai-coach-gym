import { overallStatus, type HealthResponse } from '@ai-coach/shared';

export interface HealthService {
  check(): Promise<HealthResponse>;
}

export interface HealthServiceDeps {
  pingDatabase: () => Promise<unknown>;
  listOllamaModels: () => Promise<string[]>;
  ollamaModel: string;
  version: string;
  timeoutMs?: number;
}

type Timed<T> = { ok: true; value: T; latencyMs: number } | { ok: false; latencyMs: null };

async function timed<T>(fn: () => Promise<T>, timeoutMs: number): Promise<Timed<T>> {
  const start = performance.now();
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('timeout')), timeoutMs);
  });
  try {
    const value = await Promise.race([fn(), timeout]);
    return { ok: true, value, latencyMs: Math.round(performance.now() - start) };
  } catch {
    return { ok: false, latencyMs: null };
  } finally {
    clearTimeout(timer);
  }
}

export function createHealthService(deps: HealthServiceDeps): HealthService {
  const timeoutMs = deps.timeoutMs ?? 2000;
  return {
    async check() {
      const [db, models] = await Promise.all([
        timed(deps.pingDatabase, timeoutMs),
        timed(deps.listOllamaModels, timeoutMs),
      ]);
      const modelAvailable = models.ok && models.value.includes(deps.ollamaModel);
      const checks: HealthResponse['checks'] = {
        database: db.ok
          ? { ok: true, latencyMs: db.latencyMs }
          : { ok: false, latencyMs: null, error: 'Không kết nối được SQL Server' },
        ollama: {
          ok: models.ok,
          latencyMs: models.latencyMs,
          model: deps.ollamaModel,
          modelAvailable,
          ...(models.ok
            ? modelAvailable
              ? {}
              : {
                  error: `Chưa có model ${deps.ollamaModel}, hãy chạy: ollama pull ${deps.ollamaModel}`,
                }
            : { error: 'Không kết nối được Ollama' }),
        },
      };
      return {
        status: overallStatus(checks),
        version: deps.version,
        time: new Date().toISOString(),
        checks,
      };
    },
  };
}
