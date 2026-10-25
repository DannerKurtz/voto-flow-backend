import { describe, expect, it } from 'vitest';
import { InMemoryResultRepository } from '../src/repositories/in-memory-result-repository.js';
import { GovernorResultsService } from '../src/services/governor-results-service.js';
import { publishSecondRoundGovernorUpdate } from '../src/second-round/publish-update.js';
import { SubscriptionHub } from '../src/websocket/subscription-hub.js';

describe('publishSecondRoundGovernorUpdate', () => {
  it('sends only a configured state update to its governor topic', async () => {
    const targets = [{ electionCode: 'runoff', scopeCode: 'ac', officeCode: 'governor' }];
    const service = new GovernorResultsService(new InMemoryResultRepository(), targets);
    const hub = new SubscriptionHub();
    const socket = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    hub.subscribeSecondRoundGovernor(socket, 'ac');
    await publishSecondRoundGovernorUpdate(targets[0], service, hub);
    expect(JSON.parse(socket.sent[0])).toMatchObject({
      type: 'second-round.governor.updated', data: { scopeCode: 'ac', result: { availability: 'pending' } },
    });
    await publishSecondRoundGovernorUpdate({ ...targets[0], scopeCode: 'sp' }, service, hub);
    expect(socket.sent).toHaveLength(1);
  });
});
