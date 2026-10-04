import { z } from 'zod';

const pollTargetSchema = z.object({
  electionCode: z.string().min(1),
  scopeCode: z.string().min(1),
  officeCode: z.string().min(1),
  sourceUrl: z.url(),
});

const configSchema = z.object({
  DATABASE_URL: z.url().default('postgresql://voto_flow:voto_flow@localhost:5432/voto_flow'),
  HOST: z.string().default('0.0.0.0'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:3001'),
  TSE_MAX_REQUESTS_PER_SECOND: z.coerce.number().int().min(1).max(10).default(10),
  TSE_POLL_INTERVAL_MS: z.coerce.number().int().min(1_000).default(30_000),
  TSE_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(60_000).default(10_000),
});

export type AppConfig = z.infer<typeof configSchema>;

export function loadConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  return configSchema.parse(environment);
}

export type PollTargetConfig = z.infer<typeof pollTargetSchema>;

export function loadPollTargets(value: string | undefined): PollTargetConfig[] {
  if (!value) return [];
  try {
    return z.array(pollTargetSchema).parse(JSON.parse(value));
  } catch (error) {
    throw new Error(`TSE_POLL_TARGETS must be a JSON array of result targets: ${error instanceof Error ? error.message : 'invalid value'}`);
  }
}
