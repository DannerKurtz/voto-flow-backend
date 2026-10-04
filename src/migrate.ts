import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { createDatabase } from './database.js';

const migrationsDirectory = fileURLToPath(new URL('../migrations/', import.meta.url));

async function migrate(): Promise<void> {
  const { DATABASE_URL } = loadConfig();
  if (!DATABASE_URL) throw new Error('DATABASE_URL is required to run migrations');
  const database = createDatabase(DATABASE_URL);
  const client = await database.connect();
  try {
    await client.query('CREATE TABLE IF NOT EXISTS schema_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())');
    const applied = await client.query<{ id: string }>('SELECT id FROM schema_migrations');
    const appliedIds = new Set(applied.rows.map((row) => row.id));
    for (const id of (await readdir(migrationsDirectory)).filter((file) => file.endsWith('.sql')).sort()) {
      if (appliedIds.has(id)) continue;
      await client.query('BEGIN');
      await client.query(await readFile(`${migrationsDirectory}/${id}`, 'utf8'));
      await client.query('INSERT INTO schema_migrations (id) VALUES ($1)', [id]);
      await client.query('COMMIT');
      console.log(`Applied migration ${id}`);
    }
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await database.end();
  }
}

void migrate();
