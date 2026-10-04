import { GlobalRequestRateLimiter } from './rate-limiter.js';

export type TseJsonRequest = {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
};

export type TseJsonResponse =
  | { status: 'not-modified'; etag: string | null; lastModified: string | null }
  | { status: 'updated'; rawPayload: string; payload: unknown; etag: string | null; lastModified: string | null };

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

export class TseHttpError extends Error {
  constructor(readonly statusCode: number, readonly url: string) {
    super(`TSE returned HTTP ${statusCode} for ${url}`);
  }
}

export class TseClient {
  private readonly limiter: GlobalRequestRateLimiter;

  constructor(private readonly options: {
    fetcher?: Fetcher;
    timeoutMs: number;
    limiter?: GlobalRequestRateLimiter;
  }) {
    this.limiter = options.limiter ?? new GlobalRequestRateLimiter();
  }

  async getJson(request: TseJsonRequest): Promise<TseJsonResponse> {
    await this.limiter.acquire();
    const headers: Record<string, string> = { accept: 'application/json' };
    if (request.etag) headers['If-None-Match'] = request.etag;
    if (request.lastModified) headers['If-Modified-Since'] = request.lastModified;
    const response = await (this.options.fetcher ?? fetch)(request.url, {
      headers,
      signal: AbortSignal.timeout(this.options.timeoutMs),
    });
    const metadata = {
      etag: response.headers.get('etag'),
      lastModified: response.headers.get('last-modified'),
    };
    if (response.status === 304) return { status: 'not-modified', ...metadata };
    if (!response.ok) throw new TseHttpError(response.status, request.url);
    const rawPayload = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(rawPayload);
    } catch {
      throw new Error(`TSE returned invalid JSON for ${request.url}`);
    }
    return { status: 'updated', rawPayload, payload, ...metadata };
  }
}
