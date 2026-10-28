import type { Profile } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { userIdOf } from '../../lib/http.js';
import type { ProfileService } from './profile.service.js';

export function createProfileController(profiles: ProfileService) {
  const get: RequestHandler = async (_req, res) => {
    res.json(await profiles.get(userIdOf(res)));
  };
  const save: RequestHandler = async (req, res) => {
    res.json(await profiles.save(userIdOf(res), req.body as Profile));
  };
  return { get, save };
}
