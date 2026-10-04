import { describe, expect, it, vi } from 'vitest';

import { TseClient } from '../src/tse/tse-client.js';

describe('TseClient', () => {
  it('sends documented conditional headers and preserves a 304 response', async () => {
    const fetcher = vi.fn(async () => new Response(null, {
      status: 304,
      headers: { etag: '"next"', 'last-modified': 'Sat, 04 Oct 2026 17:00:00 GMT' },
    }));
    const client = new TseClient({ fetcher, timeoutMs: 1_000 });

    const result = await client.getJson({
      url: 'https://resultados.example/ea20.json',
      etag: '"previous"',
      lastModified: 'Sat, 04 Oct 2026 16:00:00 GMT',
    });

    expect(result).toEqual({ status: 'not-modified', etag: '"next"', lastModified: 'Sat, 04 Oct 2026 17:00:00 GMT' });
    expect(fetcher.mock.calls[0][1]?.headers).toMatchObject({
      'If-None-Match': '"previous"',
      'If-Modified-Since': 'Sat, 04 Oct 2026 16:00:00 GMT',
    });
  });

  it('returns parsed JSON and raw content for snapshot hashing', async () => {
    const client = new TseClient({
      fetcher: async () => new Response('{"abr":"br"}', { status: 200, headers: { etag: '"v1"' } }),
      timeoutMs: 1_000,
    });

    await expect(client.getJson({ url: 'https://resultados.example/ea20.json' })).resolves.toEqual({
      status: 'updated', rawPayload: '{"abr":"br"}', payload: { abr: 'br' }, etag: '"v1"', lastModified: null,
    });
  });
});
