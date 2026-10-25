import { describe, expect, it } from 'vitest';

import { calculateEstimatedSurplus } from '../src/second-round/estimated-surplus.js';

const candidate = (key: string, firstRoundVotes: number, secondRoundVotes: number) => ({
  key,
  firstRoundVotes,
  secondRoundVotes,
});

describe('calculateEstimatedSurplus', () => {
  it('keeps the estimate unavailable while both candidates are below their first-round totals', () => {
    expect(calculateEstimatedSurplus([
      candidate('flavio', 100, 90),
      candidate('lula', 120, 110),
    ])).toEqual({
      estimated: true,
      eligible: false,
      candidates: [
        { key: 'flavio', votes: null },
        { key: 'lula', votes: null },
      ],
    });
  });

  it('starts the estimate when both candidates equal their first-round totals', () => {
    expect(calculateEstimatedSurplus([
      candidate('flavio', 100, 100),
      candidate('lula', 120, 120),
    ])).toEqual({
      estimated: true,
      eligible: true,
      candidates: [
        { key: 'flavio', votes: 0 },
        { key: 'lula', votes: 0 },
      ],
    });
  });

  it('returns each candidate excess only after both candidates reached the baseline', () => {
    expect(calculateEstimatedSurplus([
      candidate('flavio', 100, 125),
      candidate('lula', 120, 145),
    ])).toEqual({
      estimated: true,
      eligible: true,
      candidates: [
        { key: 'flavio', votes: 25 },
        { key: 'lula', votes: 25 },
      ],
    });
  });

  it('does not expose a zero estimate when only one candidate reached the baseline', () => {
    expect(calculateEstimatedSurplus([
      candidate('flavio', 100, 130),
      candidate('lula', 120, 119),
    ])).toEqual({
      estimated: true,
      eligible: false,
      candidates: [
        { key: 'flavio', votes: null },
        { key: 'lula', votes: null },
      ],
    });
  });

  it('keeps the estimate unavailable when a state has no result data', () => {
    expect(calculateEstimatedSurplus(undefined)).toEqual({
      estimated: true,
      eligible: false,
      candidates: [],
    });
  });

  it('allows an estimate during partial totalization when both baselines were reached', () => {
    expect(calculateEstimatedSurplus([
      candidate('flavio', 100, 130),
      candidate('lula', 120, 120),
    ])).toEqual({
      estimated: true,
      eligible: true,
      candidates: [
        { key: 'flavio', votes: 30 },
        { key: 'lula', votes: 0 },
      ],
    });
  });
});
