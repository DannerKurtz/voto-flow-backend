import { z } from 'zod';

import type { SecondRoundComparisonConfig } from '../config.js';
import { calculateEstimatedSurplus, type EstimatedSurplus } from './estimated-surplus.js';

const officialNumberSchema = z.union([z.string(), z.number()]);
const candidateSchema = z.object({
  sqcand: officialNumberSchema,
  nm: z.string(),
  nmu: z.string(),
  vap: officialNumberSchema,
  pvap: officialNumberSchema,
});
const ea20Schema = z.object({
  s: z.object({ pst: officialNumberSchema }),
  v: z.object({ vb: officialNumberSchema, vn: officialNumberSchema }),
  carg: z.array(z.object({
    agr: z.array(z.object({
      par: z.array(z.object({ sg: z.string().optional(), cand: z.array(candidateSchema) })),
    })),
  })),
});

const estimatedSurplusLabel = 'Outros candidatos, nulos e brancos (estimativa)';

export type OfficialCandidate = {
  sqcand: string;
  name: string;
  ballotName: string;
  party?: string;
  votes: number;
  percentage: number;
};

export type NormalizedEa20 = {
  totalizationPercentage: number;
  blankVotes: number;
  nullVotes: number;
  candidates: OfficialCandidate[];
};

export type PresidentialComparison = {
  scope: { code: string; level: 'national' | 'state' };
  availability: 'pending' | 'ready';
  firstRound: {
    electionCode: string;
    totalizationPercentage: number;
    candidates: Array<OfficialCandidate & { key: string }>;
  } | null;
  secondRound: {
    electionCode: string;
    totalizationPercentage: number;
    blankVotes: number;
    nullVotes: number;
    candidates: Array<OfficialCandidate & { key: string }>;
  } | null;
  estimatedSurplus: EstimatedSurplus & { label: string };
};

export function buildPresidentialComparison(
  config: SecondRoundComparisonConfig,
  scopeCode: string,
  firstRoundPayload: unknown | undefined,
  secondRoundPayload: unknown | undefined,
): PresidentialComparison {
  const scope = { code: scopeCode, level: scopeCode === 'br' ? 'national' as const : 'state' as const };
  if (!firstRoundPayload || !secondRoundPayload) {
    return {
      scope,
      availability: 'pending',
      firstRound: null,
      secondRound: null,
      estimatedSurplus: { ...calculateEstimatedSurplus(undefined), label: estimatedSurplusLabel },
    };
  }

  const firstRound = normalizeEa20(firstRoundPayload);
  const secondRound = normalizeEa20(secondRoundPayload);
  const firstRoundCandidates = config.candidates.map((candidate) => ({
    key: candidate.key,
    ...findCandidate(firstRound.candidates, candidate.firstRoundSqcand),
  }));
  const secondRoundCandidates = config.candidates.map((candidate) => ({
    key: candidate.key,
    ...findCandidate(secondRound.candidates, candidate.secondRoundSqcand),
  }));

  return {
    scope,
    availability: 'ready',
    firstRound: {
      electionCode: config.firstRound.electionCode,
      totalizationPercentage: firstRound.totalizationPercentage,
      candidates: firstRoundCandidates,
    },
    secondRound: {
      electionCode: config.secondRound.electionCode,
      totalizationPercentage: secondRound.totalizationPercentage,
      blankVotes: secondRound.blankVotes,
      nullVotes: secondRound.nullVotes,
      candidates: secondRoundCandidates,
    },
    estimatedSurplus: {
      ...calculateEstimatedSurplus(config.candidates.map((candidate, index) => ({
        key: candidate.key,
        firstRoundVotes: firstRoundCandidates[index].votes,
        secondRoundVotes: secondRoundCandidates[index].votes,
      }))),
      label: estimatedSurplusLabel,
    },
  };
}

export function normalizeEa20(payload: unknown): NormalizedEa20 {
  const parsed = ea20Schema.parse(payload);
  return {
    totalizationPercentage: parseOfficialNumber(parsed.s.pst),
    blankVotes: parseOfficialNumber(parsed.v.vb),
    nullVotes: parseOfficialNumber(parsed.v.vn),
    candidates: parsed.carg.flatMap((office) => office.agr.flatMap((aggregation) => (
      aggregation.par.flatMap((party) => party.cand.map((candidate) => ({
        sqcand: String(candidate.sqcand),
        name: candidate.nm,
        ballotName: candidate.nmu,
        ...(party.sg ? { party: party.sg } : {}),
        votes: parseOfficialNumber(candidate.vap),
        percentage: parseOfficialNumber(candidate.pvap),
      })))
    ))),
  };
}

function parseOfficialNumber(value: string | number): number {
  const parsed = typeof value === 'number' ? value : Number(value.replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new Error(`Invalid official numeric value: ${value}`);
  return parsed;
}

function findCandidate(candidates: OfficialCandidate[], sqcand: string): OfficialCandidate {
  const candidate = candidates.find((item) => item.sqcand === sqcand);
  if (!candidate) throw new Error(`Configured candidate ${sqcand} was not found in EA20`);
  return candidate;
}
