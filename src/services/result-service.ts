import { createHash } from 'node:crypto';

import type {
  ResultDocument,
  ResultIdentity,
  ResultRepository,
  StoreResultOutcome,
} from '../repositories/result-repository.js';

export type ResultSource = ResultIdentity & {
  sourceUrl: string;
};

export class ResultService {
  constructor(private readonly repository: ResultRepository) {}

  async record(
    source: ResultSource,
    rawPayload: string,
    sourcePayload: unknown,
    metadata: { etag?: string | null; lastModified?: string | null } = {},
  ): Promise<StoreResultOutcome> {
    return this.repository.store({
      ...source,
      ...metadata,
      contentHash: createHash('sha256').update(rawPayload).digest('hex'),
      sourcePayload,
    });
  }

  async current(identity: ResultIdentity): Promise<ResultDocument | null> {
    return this.repository.getCurrent(identity);
  }
}
