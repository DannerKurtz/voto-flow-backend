import { describe, expect, it } from 'vitest';

import { SubscriptionHub } from '../src/websocket/subscription-hub.js';

describe('SubscriptionHub', () => {
  it('publishes an update only to sockets subscribed to that result', () => {
    const hub = new SubscriptionHub();
    const interested = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    const other = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    hub.subscribe(interested, { electionCode: '21270', scopeCode: 'br', officeCode: '0001' });
    hub.subscribe(other, { electionCode: '21272', scopeCode: 'sp', officeCode: '0003' });

    hub.publish({ electionCode: '21270', scopeCode: 'br', officeCode: '0001' }, { totalizado: '10' });

    expect(interested.sent).toEqual([JSON.stringify({
      type: 'result.updated',
      data: { electionCode: '21270', scopeCode: 'br', officeCode: '0001', sourcePayload: { totalizado: '10' } },
    })]);
    expect(other.sent).toEqual([]);
  });

  it('publishes a comparison update only to sockets subscribed to its scope', () => {
    const hub = new SubscriptionHub();
    const interested = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    const other = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    hub.subscribeSecondRoundComparison(interested, 'sp');
    hub.subscribeSecondRoundComparison(other, 'br');

    hub.publishSecondRoundComparison('sp', { availability: 'ready' });

    expect(interested.sent).toEqual([JSON.stringify({
      type: 'second-round.comparison.updated',
      data: { scopeCode: 'sp', comparison: { availability: 'ready' } },
    })]);
    expect(other.sent).toEqual([]);
  });
});
