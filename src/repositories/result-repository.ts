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

export interface ResultReader {
  getCurrent(identity: ResultIdentity): Promise<ResultDocument | null>;
  getCurrentMany(identities: readonly ResultIdentity[]): Promise<ResultDocument[]>;
}

export interface SnapshotReader {
  listSnapshots(identity: ResultIdentity): Promise<ResultSnapshot[]>;
}

export interface ResultWriter {
  store(input: StoreResultDocument): Promise<StoreResultOutcome>;
}

export interface ResultRepository extends ResultReader, SnapshotReader, ResultWriter {}

export function resultKey(identity: ResultIdentity): string {
  return JSON.stringify([identity.electionCode, identity.scopeCode, identity.officeCode]);
}
