import { z } from 'zod';

export const serviceCheckSchema = z.object({
  ok: z.boolean(),
  latencyMs: z.number().nonnegative().nullable(),
  error: z.string().optional(),
});

export const ollamaCheckSchema = serviceCheckSchema.extend({
  model: z.string(),
  modelAvailable: z.boolean(),
});

export const healthChecksSchema = z.object({
  database: serviceCheckSchema,
  ollama: ollamaCheckSchema,
});

export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  version: z.string(),
  time: z.iso.datetime(),
  checks: healthChecksSchema,
});

export type ServiceCheck = z.infer<typeof serviceCheckSchema>;
export type OllamaCheck = z.infer<typeof ollamaCheckSchema>;
export type HealthChecks = z.infer<typeof healthChecksSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;

/** The system is only "ok" when MySQL answers and Ollama has the configured model pulled. */
export function overallStatus(checks: HealthChecks): HealthResponse['status'] {
  return checks.database.ok && checks.ollama.ok && checks.ollama.modelAvailable ? 'ok' : 'degraded';
}
