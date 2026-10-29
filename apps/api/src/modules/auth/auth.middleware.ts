import type { RequestHandler } from 'express';
import { AppError, userIdOf } from '../../lib/http.js';
import type { UserRepository } from '../users/user.repository.js';
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

/** Health data may only be processed after the consent screen (AGENTS.md §4.1); runs after requireAuth. */
export function requireHealthConsent(users: Pick<UserRepository, 'findById'>): RequestHandler {
  return async (_req, res, next) => {
    const user = await users.findById(userIdOf(res));
    if (!user?.healthConsentAt) {
      throw new AppError(
        403,
        'CONSENT_REQUIRED',
        'Bạn cần đồng ý xử lý dữ liệu sức khỏe trước khi sử dụng tính năng này',
      );
    }
    next();
  };
}

/** Runs two middlewares in order as one (routers take a single auth handler). */
export function both(first: RequestHandler, second: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(
      first(req, res, (err?: unknown) => {
        if (err) {
          next(err);
          return;
        }
        Promise.resolve(second(req, res, next)).catch(next);
      }),
    ).catch(next);
  };
}
