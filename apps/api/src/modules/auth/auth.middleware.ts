import type { RequestHandler } from 'express';
import { AppError } from '../../lib/http.js';
import type { TokenService } from './token.service.js';

/** Accepts "Authorization: Bearer <jwt>" and stores the user id in res.locals.userId. */
export function requireAuth(tokens: TokenService): RequestHandler {
  return async (req, res, next) => {
    const header = req.get('authorization') ?? '';
    const [scheme, token] = header.split(' ');
    const userId = scheme === 'Bearer' && token ? await tokens.verify(token) : null;
    if (!userId) throw new AppError(401, 'UNAUTHENTICATED', 'Vui lòng đăng nhập để tiếp tục');
    res.locals.userId = userId;
    next();
  };
}
