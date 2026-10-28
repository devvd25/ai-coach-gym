import { healthResponseSchema, type HealthResponse } from '@ai-coach/shared';

/** /health answers 503 with a valid body when a dependency is down, so both codes are parsed. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const res = await fetch('/health', { signal });
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`API trả về mã ${res.status}`);
  }
  return healthResponseSchema.parse(await res.json());
}
