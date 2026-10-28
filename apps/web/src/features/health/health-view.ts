import type { HealthResponse } from '@ai-coach/shared';

export interface ServiceRow {
  key: 'api' | 'database' | 'ollama';
  label: string;
  ok: boolean;
  detail: string;
  latency: string;
}

const ms = (value: number | null) => (value === null ? '—' : `${value} ms`);

/** Turns a health payload (or a failed request) into the three rows the status page shows. */
export function toServiceRows(
  health: HealthResponse | undefined,
  apiReachable: boolean,
): ServiceRow[] {
  if (!apiReachable || !health) {
    return [
      {
        key: 'api',
        label: 'API (Express)',
        ok: false,
        detail: 'Chưa kết nối được API. Chạy pnpm dev ở thư mục gốc.',
        latency: '—',
      },
      { key: 'database', label: 'SQL Server', ok: false, detail: 'Chưa kiểm tra', latency: '—' },
      { key: 'ollama', label: 'Ollama', ok: false, detail: 'Chưa kiểm tra', latency: '—' },
    ];
  }
  const { database, ollama } = health.checks;
  return [
    {
      key: 'api',
      label: 'API (Express)',
      ok: true,
      detail: `Phiên bản ${health.version}`,
      latency: '—',
    },
    {
      key: 'database',
      label: 'SQL Server',
      ok: database.ok,
      detail: database.ok ? 'Đã kết nối' : (database.error ?? 'Lỗi không xác định'),
      latency: ms(database.latencyMs),
    },
    {
      key: 'ollama',
      label: 'Ollama',
      ok: ollama.ok && ollama.modelAvailable,
      detail:
        ollama.ok && ollama.modelAvailable
          ? `Model ${ollama.model} sẵn sàng`
          : (ollama.error ?? 'Lỗi không xác định'),
      latency: ms(ollama.latencyMs),
    },
  ];
}
