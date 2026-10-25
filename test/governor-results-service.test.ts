import { describe, expect, it } from 'vitest';

import { InMemoryResultRepository } from '../src/repositories/in-memory-result-repository.js';
import { ResultService } from '../src/services/result-service.js';
import { GovernorResultsService } from '../src/services/governor-results-service.js';

const targets = [
  { electionCode: 'runoff', scopeCode: 'ac', officeCode: 'governor' },
  { electionCode: 'runoff', scopeCode: 'df', officeCode: 'governor' },
];
const payload = {
  s: { pst: '72,50' },
  v: { vb: '100', vn: '200' },
  carg: [{ agr: [{ par: [{ cand: [
    { sqcand: '10', nm: 'Candidato A', nmu: 'A', vap: '600', pvap: '55,00' },
    { sqcand: '20', nm: 'Candidato B', nmu: 'B', vap: '500', pvap: '45,00' },
  ] }] }] }],
};

describe('GovernorResultsService', () => {
  it('returns configured state results normalized and ordered by official vote totals', async () => {
    const repository = new InMemoryResultRepository();
    await new ResultService(repository).record({ ...targets[0], sourceUrl: 'https://example.com/ac' }, 'ac-v1', payload);
    const results = await new GovernorResultsService(repository, targets).list();
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      scope: { code: 'ac', level: 'state' }, availability: 'ready',
      secondRound: { totalizationPercentage: 72.5, candidates: [{ votes: 600 }, { votes: 500 }] },
    });
    expect(results[1]).toMatchObject({ scope: { code: 'df' }, availability: 'pending', secondRound: null });
  });

  it('matches only configured election, scope and office identities', () => {
    const service = new GovernorResultsService(new InMemoryResultRepository(), targets);
    expect(service.matches(targets[0])).toBe(true);
    expect(service.matches({ ...targets[0], scopeCode: 'sp' })).toBe(false);
  });
});
