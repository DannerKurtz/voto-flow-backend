import { describe, expect, it } from 'vitest';

import type { SecondRoundComparisonConfig } from '../src/config.js';
import { buildPresidentialComparison, normalizeEa20 } from '../src/second-round/presidential-comparison.js';

const config: SecondRoundComparisonConfig = {
  firstRound: { electionCode: 'first', officeCode: '0001' },
  secondRound: { electionCode: 'second', officeCode: '0001' },
  scopes: ['br', 'sp'],
  candidates: [
    { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
    { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
  ],
};

function ea20(payload: {
  totalization: string;
  blankVotes?: string;
  nullVotes?: string;
  sections?: { ts: string | number; st: string | number };
  candidates: Array<{ sqcand: string; name: string; ballotName: string; votes: string; percentage: string }>;
}) {
  return {
    s: { pst: payload.totalization, ...payload.sections },
    v: { vb: payload.blankVotes ?? '0', vn: payload.nullVotes ?? '0' },
    carg: [{
      agr: [{
        par: [{
          cand: payload.candidates.map((candidate) => ({
            sqcand: candidate.sqcand,
            nm: candidate.name,
            nmu: candidate.ballotName,
            vap: candidate.votes,
            pvap: candidate.percentage,
          })),
        }],
      }],
    }],
  };
}

describe('buildPresidentialComparison', () => {
  it('preserves official section totals for zero, partial and completed counts without inventing missing counts', () => {
    for (const [totalized, totalization] of [[0, '0,00'], [25, '25,00'], [100, '100,00']] as const) {
      const result = normalizeEa20(ea20({ totalization, candidates: [], sections: { ts: '100', st: totalized } }));
      expect(result.sections).toEqual({ total: 100, totalized });
    }
    expect(normalizeEa20(ea20({ totalization: '10,00', candidates: [] })).sections).toBeUndefined();
    expect(() => normalizeEa20(ea20({ totalization: '10,00', candidates: [], sections: { ts: 100, st: 101 } }))).toThrow('section counts');
    expect(() => normalizeEa20(ea20({ totalization: '10,00', candidates: [], sections: { ts: 100, st: -1 } }))).toThrow('section counts');
  });
  it('associates each candidate with the official party rather than the coalition', () => {
    const candidate = (sqcand: string) => ({ sqcand, nm: sqcand, nmu: sqcand, vap: '100', pvap: '50,00' });
    const result = normalizeEa20({ s: { pst: '10,00' }, v: { vb: '0', vn: '0' },
      carg: [{ agr: [{ nm: 'COLIGAÇÃO', par: [
        { sg: 'PL', cand: [candidate('a')] }, { sg: 'PT', cand: [candidate('b')] },
      ] }] }] });
    expect(result.candidates.map(({ sqcand, party }) => ({ sqcand, party }))).toEqual([
      { sqcand: 'a', party: 'PL' }, { sqcand: 'b', party: 'PT' },
    ]);
  });
  it('returns official first- and second-round data with a separately labelled estimate', () => {
    const result = buildPresidentialComparison(
      config,
      'sp',
      ea20({
        totalization: '100,00',
        candidates: [
          { sqcand: '100', name: 'Flávio Bolsonaro', ballotName: 'FLÁVIO', votes: '100', percentage: '45,00' },
          { sqcand: '300', name: 'Luiz Inácio Lula da Silva', ballotName: 'LULA', votes: '120', percentage: '55,00' },
        ],
      }),
      ea20({
        totalization: '42,50',
        blankVotes: '15',
        nullVotes: '25',
        candidates: [
          { sqcand: '200', name: 'Flávio Bolsonaro', ballotName: 'FLÁVIO', votes: '130', percentage: '52,00' },
          { sqcand: '400', name: 'Luiz Inácio Lula da Silva', ballotName: 'LULA', votes: '125', percentage: '48,00' },
        ],
      }),
    );

    expect(result).toEqual({
      scope: { code: 'sp', level: 'state' },
      availability: 'ready',
      firstRound: {
        electionCode: 'first',
        totalizationPercentage: 100,
        candidates: [
          { key: 'flavio', sqcand: '100', name: 'Flávio Bolsonaro', ballotName: 'FLÁVIO', votes: 100, percentage: 45 },
          { key: 'lula', sqcand: '300', name: 'Luiz Inácio Lula da Silva', ballotName: 'LULA', votes: 120, percentage: 55 },
        ],
      },
      secondRound: {
        electionCode: 'second',
        totalizationPercentage: 42.5,
        blankVotes: 15,
        nullVotes: 25,
        candidates: [
          { key: 'flavio', sqcand: '200', name: 'Flávio Bolsonaro', ballotName: 'FLÁVIO', votes: 130, percentage: 52 },
          { key: 'lula', sqcand: '400', name: 'Luiz Inácio Lula da Silva', ballotName: 'LULA', votes: 125, percentage: 48 },
        ],
      },
      estimatedSurplus: {
        estimated: true,
        eligible: true,
        label: 'Outros candidatos, nulos e brancos (estimativa)',
        candidates: [
          { key: 'flavio', votes: 30 },
          { key: 'lula', votes: 5 },
        ],
      },
    });
  });

  it('returns pending without presenting a partial comparison when either round is absent', () => {
    expect(buildPresidentialComparison(config, 'sp', undefined, undefined)).toEqual({
      scope: { code: 'sp', level: 'state' },
      availability: 'pending',
      firstRound: null,
      secondRound: null,
      estimatedSurplus: {
        estimated: true,
        eligible: false,
        label: 'Outros candidatos, nulos e brancos (estimativa)',
        candidates: [],
      },
    });
  });

  it('marks Brazil as a national scope', () => {
    expect(buildPresidentialComparison(config, 'br', undefined, undefined).scope).toEqual({ code: 'br', level: 'national' });
  });
});
