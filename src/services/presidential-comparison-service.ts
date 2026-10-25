import type { SecondRoundComparisonConfig } from '../config.js';
import type { ResultIdentity, ResultRepository } from '../repositories/result-repository.js';
import { buildPresidentialComparison, type PresidentialComparison } from '../second-round/presidential-comparison.js';

export class PresidentialComparisonService {
  constructor(
    private readonly repository: ResultRepository,
    readonly config: SecondRoundComparisonConfig,
  ) {}

  async list(): Promise<PresidentialComparison[]> {
    return Promise.all(this.config.scopes.map((scopeCode) => this.currentConfiguredScope(scopeCode)));
  }

  async current(scopeCode: string): Promise<PresidentialComparison | null> {
    if (!this.config.scopes.includes(scopeCode)) return null;
    return this.currentConfiguredScope(scopeCode);
  }

  matches(identity: ResultIdentity): boolean {
    if (!this.config.scopes.includes(identity.scopeCode)) return false;
    return [this.config.firstRound, this.config.secondRound].some((round) => (
      identity.electionCode === round.electionCode && identity.officeCode === round.officeCode
    ));
  }

  private async currentConfiguredScope(scopeCode: string): Promise<PresidentialComparison> {
    const [firstRound, secondRound] = await Promise.all([
      this.repository.getCurrent({
        electionCode: this.config.firstRound.electionCode,
        scopeCode,
        officeCode: this.config.firstRound.officeCode,
      }),
      this.repository.getCurrent({
        electionCode: this.config.secondRound.electionCode,
        scopeCode,
        officeCode: this.config.secondRound.officeCode,
      }),
    ]);
    return buildPresidentialComparison(
      this.config,
      scopeCode,
      firstRound?.sourcePayload,
      secondRound?.sourcePayload,
    );
  }
}
