import { describe, expect, it } from 'vitest';

import { loadPollTargets, loadSecondRoundComparisonConfig } from '../src/config.js';

describe('loadPollTargets', () => {
  it('accepts configured TSE result targets', () => {
    expect(loadPollTargets('[{"electionCode":"21270","scopeCode":"br","officeCode":"0001","sourceUrl":"https://resultados.example/ea20.json"}]')).toEqual([
      { electionCode: '21270', scopeCode: 'br', officeCode: '0001', sourceUrl: 'https://resultados.example/ea20.json' },
    ]);
  });

  it('rejects malformed target configuration', () => {
    expect(() => loadPollTargets('{')).toThrow('TSE_POLL_TARGETS');
  });
});

describe('loadSecondRoundComparisonConfig', () => {
  const targets = loadPollTargets(JSON.stringify([
    { electionCode: 'first', scopeCode: 'br', officeCode: '0001', sourceUrl: 'https://resultados.example/first-br.json' },
    { electionCode: 'second', scopeCode: 'br', officeCode: '0001', sourceUrl: 'https://resultados.example/second-br.json' },
    { electionCode: 'first', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://resultados.example/first-sp.json' },
    { electionCode: 'second', scopeCode: 'sp', officeCode: '0001', sourceUrl: 'https://resultados.example/second-sp.json' },
  ]));

  const value = JSON.stringify({
    firstRound: { electionCode: 'first', officeCode: '0001' },
    secondRound: { electionCode: 'second', officeCode: '0001' },
    scopes: ['br', 'sp'],
    candidates: [
      { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
      { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
    ],
  });

  it('accepts the configured rounds, candidates, and scopes backed by polling targets', () => {
    expect(loadSecondRoundComparisonConfig(value, targets)).toMatchObject({
      firstRound: { electionCode: 'first', officeCode: '0001' },
      secondRound: { electionCode: 'second', officeCode: '0001' },
      scopes: ['br', 'sp'],
      candidates: [
        { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
        { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
      ],
    });
  });

  it('returns null when the comparison feature is not configured', () => {
    expect(loadSecondRoundComparisonConfig(undefined, targets)).toBeNull();
  });

  it('rejects a scope that does not have both configured polling targets', () => {
    const missingSecondRoundTarget = targets.filter((target) => !(target.scopeCode === 'sp' && target.electionCode === 'second'));

    expect(() => loadSecondRoundComparisonConfig(value, missingSecondRoundTarget)).toThrow('SECOND_ROUND_COMPARISON_CONFIG');
  });
});
