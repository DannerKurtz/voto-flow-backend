import { describe, expect, it } from 'vitest';

import { InMemoryResultRepository } from '../src/repositories/result-repository.js';
import { ResultPoller } from '../src/polling/result-poller.js';
import { ResultService } from '../src/services/result-service.js';
import { TseClient } from '../src/tse/tse-client.js';
import { SubscriptionHub } from '../src/websocket/subscription-hub.js';

describe('ResultPoller', () => {
  it('stores and publishes a changed official document', async () => {
    const repository = new InMemoryResultRepository();
    const hub = new SubscriptionHub();
    const socket = { sent: [] as string[], send(message: string) { this.sent.push(message); } };
    const target = {
      electionCode: '21270', officeCode: '0001', scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };
    hub.subscribe(socket, target);
    const poller = new ResultPoller({
      client: new TseClient({
        fetcher: async () => new Response('{"totalizado":"10"}', { status: 200 }), timeoutMs: 1_000,
      }),
      resultService: new ResultService(repository),
      subscriptionHub: hub,
      targets: [target],
    });

    await expect(poller.runOnce()).resolves.toEqual({ checked: 1, changed: 1, notModified: 0 });
    expect(socket.sent).toHaveLength(1);
    await expect(repository.getCurrent(target)).resolves.toMatchObject({ sourcePayload: { totalizado: '10' } });
  });
});
