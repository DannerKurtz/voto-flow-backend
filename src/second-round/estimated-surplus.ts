export type CandidateVoteComparison = {
  key: string;
  firstRoundVotes: number;
  secondRoundVotes: number;
};

export type EstimatedSurplus = {
  estimated: true;
  eligible: boolean;
  candidates: Array<{ key: string; votes: number | null }>;
};

export function calculateEstimatedSurplus(
  candidates: CandidateVoteComparison[] | undefined,
): EstimatedSurplus {
  if (!candidates) {
    return { estimated: true, eligible: false, candidates: [] };
  }

  const eligible = candidates.every((candidate) => candidate.secondRoundVotes >= candidate.firstRoundVotes);
  return {
    estimated: true,
    eligible,
    candidates: candidates.map((candidate) => ({
      key: candidate.key,
      votes: eligible ? Math.max(0, candidate.secondRoundVotes - candidate.firstRoundVotes) : null,
    })),
  };
}
