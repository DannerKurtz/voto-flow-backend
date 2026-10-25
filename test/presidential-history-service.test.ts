import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { SecondRoundComparisonConfig } from '../src/config.js';
import type { ResultSnapshot } from '../src/repositories/result-repository.js';
import { PresidentialHistoryService } from '../src/services/presidential-history-service.js';

const config: SecondRoundComparisonConfig = {
  firstRound: { electionCode: 'first', officeCode: 'office' }, secondRound: { electionCode: 'second', officeCode: 'office' },
  scopes: ['br'], candidates: [
    { key: 'flavio', firstRoundSqcand: 'a1', secondRoundSqcand: 'a2' },
    { key: 'lula', firstRoundSqcand: 'b1', secondRoundSqcand: 'b2' },
  ],
};
function snapshot(id: number, createdAt: string, a: number, b: number): ResultSnapshot {
  return { id, resultDocumentId: 1, contentHash: String(id), createdAt: new Date(createdAt), sourcePayload: {
    s: { pst: '10,50' }, v: { vb: '1', vn: '2' },
    carg: [{ agr: [{ par: [{ cand: [
      { sqcand: 'b2', nm: 'B', nmu: 'B', vap: String(b), pvap: '55,00' },
      { sqcand: 'a2', nm: 'A', nmu: 'A', vap: String(a), pvap: '45,00' },
    ] }] }] }],
  } };
}

describe('presidential vote history', () => {
  it('reads only the configured second round, orders records, and preserves vote corrections', async () => {
    const service = new PresidentialHistoryService({ listSnapshots: async (identity) => {
      expect(identity).toEqual({ electionCode: 'second', officeCode: 'office', scopeCode: 'br' });
      return [snapshot(2, '2026-10-25T20:10:00Z', 90, 150), snapshot(1, '2026-10-25T20:00:00Z', 100, 120)];
    } }, config);
    const history = await service.history('br');
    expect(history?.points.map((point) => point.recordedAt)).toEqual(['2026-10-25T20:00:00.000Z', '2026-10-25T20:10:00.000Z']);
    expect(history?.points.map((point) => point.candidates)).toEqual([
      [{ key: 'flavio', votes: 100, percentage: 45 }, { key: 'lula', votes: 120, percentage: 55 }],
      [{ key: 'flavio', votes: 90, percentage: 45 }, { key: 'lula', votes: 150, percentage: 55 }],
    ]);
  });
  it('returns an empty history for missing records and rejects unsupported scopes without reading', async () => {
    const service = new PresidentialHistoryService({ listSnapshots: async () => [] }, config);
    expect(await service.history('br')).toEqual({ electionCode: 'second', scopeCode: 'br', points: [] });
    expect(await service.history('sp')).toBeNull();
  });
  it('serves normalized history and documents the endpoint in OpenAPI', async () => {
    const service = new PresidentialHistoryService({ listSnapshots: async () => [snapshot(1, '2026-10-25T20:00:00Z', 100, 120)] }, config);
    const app = buildApp({ logger: false }, { presidentialHistoryService: service });
    try {
      const response = await app.inject('/results/second-round/president/br/history');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ electionCode: 'second', scopeCode: 'br', points: [{ totalizationPercentage: 10.5, candidates: [{ key: 'flavio', votes: 100 }, { key: 'lula', votes: 120 }] }] });
      expect((await app.inject('/results/second-round/president/sp/history')).statusCode).toBe(404);
      expect((await app.inject('/documentation/json')).json().paths).toHaveProperty('/results/second-round/president/{scopeCode}/history');
    } finally { await app.close(); }
  });
});
