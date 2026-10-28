import { fieldErrors, type ApiErrorBody } from '@ai-coach/shared';
import type { ErrorRequestHandler, RequestHandler, Response } from 'express';
import type { z } from 'zod';

/** An error whose message is safe to show to the user (Vietnamese). */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
  }
}

/** Replaces req.body with the parsed value, or answers 400 with per-field messages. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      throw new AppError(400, 'VALIDATION', 'Dữ liệu chưa hợp lệ', fieldErrors(result.error));
    }
    req.body = result.data;
    next();
  };
}

/** The user id set by requireAuth. */
export function userIdOf(res: Response): number {
  const id: unknown = res.locals.userId;
  if (typeof id !== 'number') throw new AppError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập');
  return id;
}

export const errorHandler: ErrorRequestHandler = (err: unknown, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.fields ? { fields: err.fields } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }
  // Malformed JSON bodies come from express.json() as a SyntaxError with status 400.
  if (err instanceof SyntaxError && 'status' in err && err.status === 400) {
    res.status(400).json({ error: { code: 'BAD_JSON', message: 'Dữ liệu gửi lên không hợp lệ' } });
    return;
  }
  console.error(err instanceof Error ? err.message : err);
  res
    .status(500)
    .json({ error: { code: 'INTERNAL', message: 'Đã có lỗi xảy ra, vui lòng thử lại' } });
};
