import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { errorHandler } from './lib/http.js';
import { createAiRouter } from './modules/ai/ai.routes.js';
import type { AiService } from './modules/ai/ai.service.js';
import { requireAuth } from './modules/auth/auth.middleware.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import type { AuthService } from './modules/auth/auth.service.js';
import type { TokenService } from './modules/auth/token.service.js';
import { createExerciseRouter } from './modules/exercises/exercise.routes.js';
import type { ExerciseService } from './modules/exercises/exercise.service.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import type { HealthService } from './modules/health/health.service.js';
import { createPlanRouter } from './modules/plans/plan.routes.js';
import type { PlanService } from './modules/plans/plan.service.js';
import { createSquatRouter } from './modules/squat/squat.routes.js';
import type { SquatService } from './modules/squat/squat.service.js';
import type { UserRepository } from './modules/users/user.repository.js';
import { createProfileRouter } from './modules/profile/profile.routes.js';
import type { ProfileService } from './modules/profile/profile.service.js';
import type { WeightService } from './modules/workouts/weight.service.js';
import { createWorkoutRouter } from './modules/workouts/workout.routes.js';
import type { WorkoutService } from './modules/workouts/workout.service.js';

export interface AppDeps {
  webOrigin: string;
  health: HealthService;
  auth: AuthService;
  profiles: ProfileService;
  tokens: TokenService;
  exercises: ExerciseService;
  plans: PlanService;
  workouts: WorkoutService;
  weights: WeightService;
  ai: AiService;
  squats: SquatService;
  /** Read-only use: the camera routes check the user's camera consent. */
  users: UserRepository;
  /** AI generations per user per hour. */
  aiRequestsPerHour?: number;
  /** Login/register attempts per IP per 15 minutes. */
  authAttemptsPer15Min?: number;
}

export function createApp(deps: AppDeps): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: deps.webOrigin }));
  app.use(express.json({ limit: '200kb' }));

  const auth = requireAuth(deps.tokens);
  app.use(createHealthRouter(deps.health));
  app.use(
    '/api',
    createAuthRouter(deps.auth, {
      requireAuth: auth,
      attemptsPer15Min: deps.authAttemptsPer15Min ?? 10,
    }),
  );
  app.use('/api', createProfileRouter(deps.profiles, auth));
  app.use('/api', createExerciseRouter(deps.exercises, auth));
  app.use('/api', createPlanRouter(deps.plans, auth));
  app.use('/api', createWorkoutRouter(deps.workouts, deps.weights, auth));
  app.use('/api', createSquatRouter(deps.squats, deps.users, auth));
  app.use('/api', createAiRouter(deps.ai, auth, deps.aiRequestsPerHour ?? 20));

  app.use((_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy tài nguyên' } });
  });
  app.use(errorHandler);

  return app;
}
