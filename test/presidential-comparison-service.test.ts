import { describe, expect, it } from 'vitest';

import type { SecondRoundComparisonConfig } from '../src/config.js';
import { InMemoryResultRepository } from '../src/repositories/result-repository.js';
import { PresidentialComparisonService } from '../src/services/presidential-comparison-service.js';
import { ResultService } from '../src/services/result-service.js';

const config: SecondRoundComparisonConfig = {
  firstRound: { electionCode: 'first', officeCode: '0001' },
  secondRound: { electionCode: 'second', officeCode: '0001' },
  scopes: ['br', 'sp'],
  candidates: [
    { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
    { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
  ],
};

const payload = (candidates: Array<{ sqcand: string; votes: string }>) => ({
  s: { pst: '10,00' },
  v: { vb: '1', vn: '2' },
  carg: [{ agr: [{ par: [{ cand: candidates.map((candidate) => ({
    sqcand: candidate.sqcand,
    nm: candidate.sqcand,
    nmu: candidate.sqcand,
    vap: candidate.votes,
    pvap: '50,00',
  })) }] }] }],
});

describe('PresidentialComparisonService', () => {
  it('combines the two persisted EA20 documents for a configured scope', async () => {
    const repository = new InMemoryResultRepository();
    const resultService = new ResultService(repository);
    await resultService.record(
      { electionCode: 'first', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://example.com/first-sp' },
      'first', payload([{ sqcand: '100', votes: '100' }, { sqcand: '300', votes: '120' }]),
    );
    await resultService.record(
      { electionCode: 'second', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://example.com/second-sp' },
      'second', payload([{ sqcand: '200', votes: '130' }, { sqcand: '400', votes: '140' }]),
    );

    const comparison = await new PresidentialComparisonService(repository, config).current('sp');

    expect(comparison).toMatchObject({
      availability: 'ready',
      scope: { code: 'sp', level: 'state' },
      estimatedSurplus: { estimated: true, eligible: true },
    });
  });

  it('returns a pending comparison for a configured scope with no persisted result', async () => {
    const comparison = await new PresidentialComparisonService(new InMemoryResultRepository(), config).current('br');

    expect(comparison).toMatchObject({ availability: 'pending', scope: { code: 'br', level: 'national' } });
  });

  it('returns null for an unconfigured scope', async () => {
    const comparison = await new PresidentialComparisonService(new InMemoryResultRepository(), config).current('ac');

    expect(comparison).toBeNull();
  });
});
