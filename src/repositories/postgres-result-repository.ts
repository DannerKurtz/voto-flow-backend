import type { Pool } from 'pg';

import type {
  ResultDocument,
  ResultIdentity,
  ResultRepository,
  ResultSnapshot,
  StoreResultDocument,
  StoreResultOutcome,
} from './result-repository.js';

type DocumentRow = {
  id: string;
  election_code: string;
  scope_code: string;
  office_code: string;
  source_url: string;
  etag: string | null;
  last_modified: string | null;
  content_hash: string;
  source_payload: unknown;
  fetched_at: Date;
  updated_at: Date;
};

type SnapshotRow = {
  id: string;
  result_document_id: string;
  content_hash: string;
  source_payload: unknown;
  created_at: Date;
};

const documentColumns = `
  id, election_code, scope_code, office_code, source_url, etag, last_modified,
  content_hash, source_payload, fetched_at, updated_at
`;

export class PostgresResultRepository implements ResultRepository {
  constructor(private readonly database: Pool) {}

  async getCurrent(identity: ResultIdentity): Promise<ResultDocument | null> {
    const result = await this.database.query<DocumentRow>(
      `SELECT ${documentColumns} FROM result_documents
       WHERE election_code = $1 AND scope_code = $2 AND office_code = $3`,
      [identity.electionCode, identity.scopeCode, identity.officeCode],
    );
    return result.rows[0] ? this.toDocument(result.rows[0]) : null;
  }

  async listSnapshots(identity: ResultIdentity): Promise<ResultSnapshot[]> {
    const result = await this.database.query<SnapshotRow>(
      `SELECT snapshot.id, snapshot.result_document_id, snapshot.content_hash,
              snapshot.source_payload, snapshot.created_at
       FROM result_snapshots snapshot
       INNER JOIN result_documents document ON document.id = snapshot.result_document_id
       WHERE document.election_code = $1 AND document.scope_code = $2 AND document.office_code = $3
       ORDER BY snapshot.created_at DESC, snapshot.id DESC`,
      [identity.electionCode, identity.scopeCode, identity.officeCode],
    );
    return result.rows.map((row) => this.toSnapshot(row));
  }

  async store(input: StoreResultDocument): Promise<StoreResultOutcome> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query<DocumentRow>(
        `SELECT ${documentColumns} FROM result_documents
         WHERE election_code = $1 AND scope_code = $2 AND office_code = $3 FOR UPDATE`,
        [input.electionCode, input.scopeCode, input.officeCode],
      );

      if (existing.rows[0]?.content_hash === input.contentHash) {
        const updated = await client.query<DocumentRow>(
          `UPDATE result_documents
           SET source_url = $1, etag = $2, last_modified = $3, fetched_at = now()
           WHERE id = $4 RETURNING ${documentColumns}`,
          [input.sourceUrl, input.etag ?? null, input.lastModified ?? null, existing.rows[0].id],
        );
        await client.query('COMMIT');
        return { changed: false, document: this.toDocument(updated.rows[0]) };
      }

      const stored = await client.query<DocumentRow>(
        `INSERT INTO result_documents (
           election_code, scope_code, office_code, source_url, etag, last_modified, content_hash, source_payload
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         ON CONFLICT (election_code, scope_code, office_code) DO UPDATE SET
           source_url = EXCLUDED.source_url, etag = EXCLUDED.etag, last_modified = EXCLUDED.last_modified,
           content_hash = EXCLUDED.content_hash, source_payload = EXCLUDED.source_payload,
           fetched_at = now(), updated_at = now()
         RETURNING ${documentColumns}`,
        [
          input.electionCode,
          input.scopeCode,
          input.officeCode,
          input.sourceUrl,
          input.etag ?? null,
          input.lastModified ?? null,
          input.contentHash,
          JSON.stringify(input.sourcePayload),
        ],
      );
      const document = this.toDocument(stored.rows[0]);
      await client.query(
        `INSERT INTO result_snapshots (result_document_id, content_hash, source_payload)
         VALUES ($1, $2, $3::jsonb) ON CONFLICT (result_document_id, content_hash) DO NOTHING`,
        [document.id, document.contentHash, JSON.stringify(document.sourcePayload)],
      );
      await client.query('COMMIT');
      return { changed: true, document };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private toDocument(row: DocumentRow): ResultDocument {
    return {
      id: Number(row.id), electionCode: row.election_code, scopeCode: row.scope_code,
      officeCode: row.office_code, sourceUrl: row.source_url, etag: row.etag,
      lastModified: row.last_modified, contentHash: row.content_hash,
      sourcePayload: row.source_payload, fetchedAt: row.fetched_at, updatedAt: row.updated_at,
    };
  }

  private toSnapshot(row: SnapshotRow): ResultSnapshot {
    return {
      id: Number(row.id), resultDocumentId: Number(row.result_document_id),
      contentHash: row.content_hash, sourcePayload: row.source_payload, createdAt: row.created_at,
    };
  }
}
