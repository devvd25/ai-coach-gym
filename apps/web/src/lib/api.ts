import { apiErrorSchema } from '@ai-coach/shared';
import type { z } from 'zod';
import { LOGOUT_EVENT, readSession, writeSession } from './session.js';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields: Record<string, string> = {},
  ) {
    super(message);
  }
}

interface Options<S extends z.ZodType> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  schema: S;
  signal?: AbortSignal;
}

/** Calls the API with the stored token and validates the response with a shared Zod schema. */
export async function api<S extends z.ZodType>(
  path: string,
  opts: Options<S>,
): Promise<z.infer<S>> {
  const session = readSession();
  let res: Response;
  try {
    res = await fetch(path, {
      method: opts.method ?? 'GET',
      signal: opts.signal,
      headers: {
        ...(opts.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(session ? { authorization: `Bearer ${session.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'NETWORK', 'Không kết nối được máy chủ. Kiểm tra API đã chạy chưa.');
  }

  const data: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && session) {
      writeSession(null);
      window.dispatchEvent(new Event(LOGOUT_EVENT));
    }
    const parsed = apiErrorSchema.safeParse(data);
    if (parsed.success) {
      const { code, message, fields } = parsed.data.error;
      throw new ApiError(res.status, code, message, fields);
    }
    throw new ApiError(res.status, 'UNKNOWN', 'Đã có lỗi xảy ra, vui lòng thử lại');
  }
  return opts.schema.parse(data);
}
