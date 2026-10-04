export type ResultIdentity = {
  electionCode: string;
  scopeCode: string;
  officeCode: string;
};

export type ResultDocument = ResultIdentity & {
  id: number;
  sourceUrl: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string;
  sourcePayload: unknown;
  fetchedAt: Date;
  updatedAt: Date;
};

export type ResultSnapshot = {
  id: number;
  resultDocumentId: number;
  contentHash: string;
  sourcePayload: unknown;
  createdAt: Date;
};

export type StoreResultDocument = ResultIdentity & {
  sourceUrl: string;
  etag?: string | null;
  lastModified?: string | null;
  contentHash: string;
  sourcePayload: unknown;
};

export type StoreResultOutcome = {
  changed: boolean;
  document: ResultDocument;
};

export interface ResultRepository {
  getCurrent(identity: ResultIdentity): Promise<ResultDocument | null>;
  listSnapshots(identity: ResultIdentity): Promise<ResultSnapshot[]>;
  store(input: StoreResultDocument): Promise<StoreResultOutcome>;
}

export class InMemoryResultRepository implements ResultRepository {
  private readonly documents = new Map<string, ResultDocument>();
  private readonly snapshots = new Map<number, ResultSnapshot[]>();
  private nextDocumentId = 1;
  private nextSnapshotId = 1;

  async getCurrent(identity: ResultIdentity): Promise<ResultDocument | null> {
    return this.documents.get(this.key(identity)) ?? null;
  }

  async listSnapshots(identity: ResultIdentity): Promise<ResultSnapshot[]> {
    const document = await this.getCurrent(identity);
    return document ? [...(this.snapshots.get(document.id) ?? [])].reverse() : [];
  }

  async store(input: StoreResultDocument): Promise<StoreResultOutcome> {
    const key = this.key(input);
    const existing = this.documents.get(key);
    const now = new Date();

    if (existing && existing.contentHash === input.contentHash) {
      const document = {
        ...existing,
        etag: input.etag ?? existing.etag,
        lastModified: input.lastModified ?? existing.lastModified,
        fetchedAt: now,
      };
      this.documents.set(key, document);
      return { changed: false, document };
    }

    const document: ResultDocument = {
      id: existing?.id ?? this.nextDocumentId++,
      electionCode: input.electionCode,
      scopeCode: input.scopeCode,
      officeCode: input.officeCode,
      sourceUrl: input.sourceUrl,
      etag: input.etag ?? null,
      lastModified: input.lastModified ?? null,
      contentHash: input.contentHash,
      sourcePayload: input.sourcePayload,
      fetchedAt: now,
      updatedAt: now,
    };
    this.documents.set(key, document);
    const snapshot: ResultSnapshot = {
      id: this.nextSnapshotId++,
      resultDocumentId: document.id,
      contentHash: document.contentHash,
      sourcePayload: document.sourcePayload,
      createdAt: now,
    };
    this.snapshots.set(document.id, [...(this.snapshots.get(document.id) ?? []), snapshot]);
    return { changed: true, document };
  }

  private key(identity: ResultIdentity): string {
    return `${identity.electionCode}:${identity.scopeCode}:${identity.officeCode}`;
  }
}
