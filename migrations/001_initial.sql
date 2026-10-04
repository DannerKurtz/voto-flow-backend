CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS result_documents (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  election_code TEXT NOT NULL, scope_code TEXT NOT NULL, office_code TEXT NOT NULL,
  source_url TEXT NOT NULL, etag TEXT, last_modified TEXT, content_hash TEXT NOT NULL,
  source_payload JSONB NOT NULL, fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (election_code, scope_code, office_code)
);
CREATE TABLE IF NOT EXISTS result_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  result_document_id BIGINT NOT NULL REFERENCES result_documents(id) ON DELETE CASCADE,
  content_hash TEXT NOT NULL, source_payload JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (result_document_id, content_hash)
);
CREATE INDEX IF NOT EXISTS result_snapshots_document_created_at_idx ON result_snapshots (result_document_id, created_at DESC);
