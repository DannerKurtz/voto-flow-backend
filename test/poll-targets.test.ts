import { describe, expect, it } from 'vitest';

import { loadPollTargets } from '../src/config.js';

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
