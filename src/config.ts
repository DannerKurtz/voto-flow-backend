import { z } from 'zod';

const pollTargetSchema = z.object({
  electionCode: z.string().min(1),
  scopeCode: z.string().min(1),
  officeCode: z.string().min(1),
  sourceUrl: z.url(),
});

const comparisonRoundSchema = z.object({
  electionCode: z.string().min(1),
  officeCode: z.string().min(1),
});

const comparisonCandidateSchema = z.object({
  key: z.string().min(1),
  firstRoundSqcand: z.string().min(1),
  secondRoundSqcand: z.string().min(1),
});

const secondRoundComparisonSchema = z.object({
  firstRound: comparisonRoundSchema,
  secondRound: comparisonRoundSchema,
  scopes: z.array(z.string().min(1)).min(1),
  candidates: z.array(comparisonCandidateSchema).length(2),
}).superRefine((config, context) => {
  if (new Set(config.scopes).size !== config.scopes.length) {
    context.addIssue({ code: 'custom', message: 'scopes must not contain duplicates' });
  }
  if (new Set(config.candidates.map((candidate) => candidate.key)).size !== config.candidates.length) {
    context.addIssue({ code: 'custom', message: 'candidate keys must be unique' });
  }
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
export type SecondRoundComparisonConfig = z.infer<typeof secondRoundComparisonSchema>;

export function loadPollTargets(value: string | undefined): PollTargetConfig[] {
  if (!value) return [];
  try {
    return z.array(pollTargetSchema).parse(JSON.parse(value));
  } catch (error) {
    throw new Error(`TSE_POLL_TARGETS must be a JSON array of result targets: ${error instanceof Error ? error.message : 'invalid value'}`);
  }
}

export function loadSecondRoundComparisonConfig(
  value: string | undefined,
  targets: PollTargetConfig[],
): SecondRoundComparisonConfig | null {
  if (!value) return null;
  try {
    const config = secondRoundComparisonSchema.parse(JSON.parse(value));
    for (const scopeCode of config.scopes) {
      for (const round of [config.firstRound, config.secondRound]) {
        const hasTarget = targets.some((target) => (
          target.electionCode === round.electionCode
          && target.officeCode === round.officeCode
          && target.scopeCode === scopeCode
        ));
        if (!hasTarget) {
          throw new Error(`missing polling target for ${round.electionCode}/${scopeCode}/${round.officeCode}`);
        }
      }
    }
    return config;
  } catch (error) {
    throw new Error(`SECOND_ROUND_COMPARISON_CONFIG must describe targets configured in TSE_POLL_TARGETS: ${error instanceof Error ? error.message : 'invalid value'}`);
  }
}
