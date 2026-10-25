import type { GovernorSecondRoundConfig } from '../config.js';
import { normalizeEa20 } from '../second-round/presidential-comparison.js';
import { resultKey, type ResultIdentity, type ResultReader } from '../repositories/result-repository.js';

export type GovernorResult = {
  scope: { code: string; level: 'state' };
  availability: 'pending' | 'ready';
  secondRound: null | {
    electionCode: string;
    totalizationPercentage: number;
    blankVotes: number;
    nullVotes: number;
    candidates: ReturnType<typeof normalizeEa20>['candidates'];
  };
};

export class GovernorResultsService {
  constructor(private readonly repository: ResultReader, readonly targets: GovernorSecondRoundConfig) {}

  async list(): Promise<GovernorResult[]> {
    const documents = await this.repository.getCurrentMany(this.targets);
    const byIdentity = new Map(documents.map((document) => [resultKey(document), document]));
    return this.targets.map((identity) => buildGovernorResult(
      identity,
      byIdentity.get(resultKey(identity))?.sourcePayload,
    ));
  }

  async current(scopeCode: string): Promise<GovernorResult | null> {
    const identity = this.targets.find((target) => target.scopeCode === scopeCode);
    if (!identity) return null;
    const document = await this.repository.getCurrent(identity);
    return buildGovernorResult(identity, document?.sourcePayload);
  }

  matches(identity: ResultIdentity): boolean {
    return this.targets.some((target) => resultKey(target) === resultKey(identity));
  }
}

function buildGovernorResult(identity: ResultIdentity, payload: unknown | undefined): GovernorResult {
  if (!payload) return {
    scope: { code: identity.scopeCode, level: 'state' },
    availability: 'pending',
    secondRound: null,
  };
  const result = normalizeEa20(payload);
  return {
    scope: { code: identity.scopeCode, level: 'state' },
    availability: 'ready',
    secondRound: {
      electionCode: identity.electionCode,
      totalizationPercentage: result.totalizationPercentage,
      blankVotes: result.blankVotes,
      nullVotes: result.nullVotes,
      candidates: [...result.candidates].sort((left, right) => right.votes - left.votes),
    },
  };
}
