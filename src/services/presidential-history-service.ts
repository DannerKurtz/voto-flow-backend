import type { SecondRoundComparisonConfig } from '../config.js';
import type { SnapshotReader } from '../repositories/result-repository.js';
import { normalizeEa20 } from '../second-round/presidential-comparison.js';

export class PresidentialHistoryService {
  constructor(private readonly repository: SnapshotReader, private readonly config: SecondRoundComparisonConfig) {}

  async history(scopeCode: string) {
    if (!this.config.scopes.includes(scopeCode)) return null;
    const snapshots = await this.repository.listSnapshots({ ...this.config.secondRound, scopeCode });
    const points = [...snapshots]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id)
      .map((snapshot) => {
        const result = normalizeEa20(snapshot.sourcePayload);
        return {
          recordedAt: snapshot.createdAt.toISOString(),
          totalizationPercentage: result.totalizationPercentage,
          candidates: this.config.candidates.map((configured) => {
            const candidate = result.candidates.find((entry) => entry.sqcand === configured.secondRoundSqcand);
            if (!candidate) throw new Error(`Configured candidate ${configured.secondRoundSqcand} was not found in snapshot`);
            return { key: configured.key, votes: candidate.votes, percentage: candidate.percentage };
          }),
        };
      });
    return { scopeCode, electionCode: this.config.secondRound.electionCode, points };
  }
}
