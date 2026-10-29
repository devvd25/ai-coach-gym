import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

// The single .env lives at the repo root so docker compose, the API and sequelize-cli share it.
const rootEnv = fileURLToPath(new URL('../../../../.env', import.meta.url));
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv);

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.url().default('http://localhost:5173'),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET cần tối thiểu 32 ký tự'),
  JWT_TTL_MINUTES: z.coerce
    .number()
    .int()
    .min(5)
    .max(24 * 60)
    .default(60),
  OLLAMA_HOST: z.url().default('http://127.0.0.1:11434'),
  OLLAMA_MODEL: z.string().min(1).default('qwen3:4b'),
  /** qwen3 "thinking" is off by default: with a JSON schema it only adds latency. */
  OLLAMA_THINK: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  OLLAMA_TIMEOUT_MS: z.coerce.number().int().min(5_000).max(600_000).default(120_000),
  AI_RATE_LIMIT_PER_HOUR: z.coerce.number().int().min(1).max(1000).default(20),
});

export type Env = z.infer<typeof envSchema>;

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  // Only variable names are printed, never their values.
  const names = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Thiếu hoặc sai biến môi trường: ${names}. Xem .env.example.`);
}

export const env: Env = parsed.data;
