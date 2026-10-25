import { describe, expect, it } from 'vitest';

import type { SecondRoundComparisonConfig } from '../src/config.js';
import { InMemoryResultRepository } from '../src/repositories/result-repository.js';
import { publishSecondRoundComparisonUpdate } from '../src/second-round/publish-update.js';
import { PresidentialComparisonService } from '../src/services/presidential-comparison-service.js';
import { SubscriptionHub } from '../src/websocket/subscription-hub.js';

const config: SecondRoundComparisonConfig = {
  firstRound: { electionCode: 'first', officeCode: '0001' },
  secondRound: { electionCode: 'second', officeCode: '0001' },
  scopes: ['br'],
  candidates: [
    { key: 'flavio', firstRoundSqcand: '100', secondRoundSqcand: '200' },
    { key: 'lula', firstRoundSqcand: '300', secondRoundSqcand: '400' },
  ],
};

describe('publishSecondRoundComparisonUpdate', () => {
  it('publishes the recomputed comparison when a configured EA20 document changes', async () => {
    const hub = new SubscriptionHub();
    const socket = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    hub.subscribeSecondRoundComparison(socket, 'br');
    const service = new PresidentialComparisonService(new InMemoryResultRepository(), config);

    await publishSecondRoundComparisonUpdate(
      { electionCode: 'second', scopeCode: 'br', officeCode: '0001' },
      service,
      hub,
    );

    expect(socket.sent).toHaveLength(1);
    expect(JSON.parse(socket.sent[0])).toEqual({
      type: 'second-round.comparison.updated',
      data: { scopeCode: 'br', comparison: expect.objectContaining({ availability: 'pending' }) },
    });
  });

  it('does not publish when an unrelated official result changes', async () => {
    const hub = new SubscriptionHub();
    const socket = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    hub.subscribeSecondRoundComparison(socket, 'br');
    const service = new PresidentialComparisonService(new InMemoryResultRepository(), config);

    await publishSecondRoundComparisonUpdate(
      { electionCode: 'other', scopeCode: 'br', officeCode: '0003' },
      service,
      hub,
    );

    expect(socket.sent).toEqual([]);
  });
});
