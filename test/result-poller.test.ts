import { afterEach, describe, expect, it, vi } from 'vitest';

import { InMemoryResultRepository } from '../src/repositories/in-memory-result-repository.js';
import { ResultPoller } from '../src/polling/result-poller.js';
import { ResultService } from '../src/services/result-service.js';
import { TseClient } from '../src/tse/tse-client.js';
import { SubscriptionHub } from '../src/websocket/subscription-hub.js';

describe('ResultPoller', () => {
  afterEach(() => vi.useRealTimers());
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

  it('does not schedule another cycle after it stops during an in-flight request', async () => {
    vi.useFakeTimers();
    let resolveResponse: ((response: Response) => void) | undefined;
    const fetcher = vi.fn(() => new Promise<Response>((resolve) => { resolveResponse = resolve; }));
    const target = {
      electionCode: '21270', officeCode: '0001', scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };
    const poller = new ResultPoller({
      client: new TseClient({ fetcher, timeoutMs: 1_000 }),
      resultService: new ResultService(new InMemoryResultRepository()),
      subscriptionHub: new SubscriptionHub(),
      targets: [target],
    });

    poller.start(1_000);
    await vi.waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
    poller.stop();
    resolveResponse?.(new Response('{"totalizado":"10"}', { status: 200 }));
    await vi.advanceTimersByTimeAsync(2_000);

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('notifies derived views only after a result document changes', async () => {
    const target = {
      electionCode: '21270', officeCode: '0001', scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };
    const onResultChanged = vi.fn();
    const poller = new ResultPoller({
      client: new TseClient({
        fetcher: async () => new Response('{"totalizado":"10"}', { status: 200 }), timeoutMs: 1_000,
      }),
      resultService: new ResultService(new InMemoryResultRepository()),
      subscriptionHub: new SubscriptionHub(),
      targets: [target],
      onResultChanged,
    });

    await poller.runOnce();

    expect(onResultChanged).toHaveBeenCalledWith({ electionCode: '21270', scopeCode: 'br', officeCode: '0001' });
  });

  it('does not notify derived views again when the fetched content did not change', async () => {
    const target = {
      electionCode: '21270', officeCode: '0001', scopeCode: 'br',
      sourceUrl: 'https://resultados.example/ea20.json',
    };
    const onResultChanged = vi.fn();
    const poller = new ResultPoller({
      client: new TseClient({
        fetcher: async () => new Response('{"totalizado":"10"}', { status: 200 }), timeoutMs: 1_000,
      }),
      resultService: new ResultService(new InMemoryResultRepository()),
      subscriptionHub: new SubscriptionHub(),
      targets: [target],
      onResultChanged,
    });

    await poller.runOnce();
    await poller.runOnce();

    expect(onResultChanged).toHaveBeenCalledTimes(1);
  });
});

describe('polling lifecycle', () => {
  const target = { electionCode: 'second', officeCode: '1', scopeCode: 'br', sourceUrl: 'https://example.com/result' };

  it('coalesces concurrent cycles and waits for persistence before stopping', async () => {
    let resolve!: (response: { status: 'not-modified'; etag: null; lastModified: null }) => void;
    const getJson = vi.fn(() => new Promise<{ status: 'not-modified'; etag: null; lastModified: null }>((done) => { resolve = done; }));
    const poller = new ResultPoller({
      client: { getJson }, resultService: new ResultService(new InMemoryResultRepository()),
      subscriptionHub: { publish: vi.fn() }, targets: [target, { ...target, scopeCode: 'sp' }],
    });
    const first = poller.runOnce();
    expect(poller.runOnce()).toBe(first);
    let stopped = false;
    const stop = poller.stop().then(() => { stopped = true; });
    await vi.waitFor(() => expect(getJson).toHaveBeenCalledTimes(1));
    expect(stopped).toBe(false);
    resolve({ status: 'not-modified', etag: null, lastModified: null });
    await stop;
    expect(getJson).toHaveBeenCalledTimes(1);
    expect(stopped).toBe(true);
  });

  it('reports a failed target and continues checking the other states', async () => {
    const onError = vi.fn();
    const poller = new ResultPoller({
      client: { getJson: vi.fn()
        .mockRejectedValueOnce(new Error('temporarily unavailable'))
        .mockResolvedValueOnce({ status: 'not-modified' }) },
      resultService: new ResultService(new InMemoryResultRepository()),
      subscriptionHub: { publish: vi.fn() }, targets: [target, { ...target, scopeCode: 'sp' }], onError,
    });
    expect(await poller.runOnce()).toEqual({ checked: 2, changed: 0, notModified: 1 });
    expect(onError).toHaveBeenCalledWith(expect.any(Error), target);
  });
});
