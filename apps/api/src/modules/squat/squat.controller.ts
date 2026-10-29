import type { SquatSessionInput } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { AppError, parseQuery, userIdOf } from '../../lib/http.js';
import type { UserRepository } from '../users/user.repository.js';
import type { SquatService } from './squat.service.js';

const listQuery = z.object({
  days: z.coerce.number().int().min(1).max(366).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export function createSquatController(squats: SquatService, users: UserRepository) {
  /** Camera results are only accepted from users who opted in to camera use (consent screen). */
  const requireCameraConsent: RequestHandler = async (_req, res, next) => {
    const user = await users.findById(userIdOf(res));
    if (!user?.consentCamera) {
      throw new AppError(
        403,
        'CAMERA_CONSENT_REQUIRED',
        'Bạn cần bật đồng ý sử dụng camera trước khi lưu kết quả',
      );
    }
    next();
  };
  const create: RequestHandler = async (req, res) => {
    res.status(201).json(await squats.create(userIdOf(res), req.body as SquatSessionInput));
  };
  const list: RequestHandler = async (req, res) => {
    const { days, limit } = parseQuery(listQuery, req.query);
    const from = days ? new Date(Date.now() - days * 86_400_000) : undefined;
    res.json(await squats.list(userIdOf(res), { from, limit }));
  };
  return { requireCameraConsent, create, list };
}
