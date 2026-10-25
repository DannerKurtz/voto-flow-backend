import { resultKey, type ResultRepository, type ResultIdentity, type ResultDocument, type ResultSnapshot, type StoreResultDocument, type StoreResultOutcome } from './result-repository.js';

export class InMemoryResultRepository implements ResultRepository {
  private readonly documents = new Map<string, ResultDocument>();
  private readonly snapshots = new Map<number, ResultSnapshot[]>();
  private nextDocumentId = 1;
  private nextSnapshotId = 1;

  async getCurrent(identity: ResultIdentity): Promise<ResultDocument | null> {
    return this.documents.get(resultKey(identity)) ?? null;
  }

  async getCurrentMany(identities: readonly ResultIdentity[]): Promise<ResultDocument[]> {
    return identities.flatMap((identity) => {
      const document = this.documents.get(resultKey(identity));
      return document ? [document] : [];
    });
  }

  async listSnapshots(identity: ResultIdentity): Promise<ResultSnapshot[]> {
    const document = await this.getCurrent(identity);
    return document ? [...(this.snapshots.get(document.id) ?? [])].reverse() : [];
  }

  async store(input: StoreResultDocument): Promise<StoreResultOutcome> {
    const key = resultKey(input);
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

}
