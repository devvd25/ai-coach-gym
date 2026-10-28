import type { ConsentInput, LoginInput, RegisterInput } from '@ai-coach/shared';
import type { RequestHandler } from 'express';
import { userIdOf } from '../../lib/http.js';
import type { AuthService } from './auth.service.js';

export function createAuthController(auth: AuthService) {
  const register: RequestHandler = async (req, res) => {
    res.status(201).json(await auth.register(req.body as RegisterInput));
  };
  const login: RequestHandler = async (req, res) => {
    res.json(await auth.login(req.body as LoginInput));
  };
  const me: RequestHandler = async (_req, res) => {
    res.json(await auth.me(userIdOf(res)));
  };
  const consent: RequestHandler = async (req, res) => {
    res.json(await auth.giveConsent(userIdOf(res), req.body as ConsentInput));
  };
  return { register, login, me, consent };
}
