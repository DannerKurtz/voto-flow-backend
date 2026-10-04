import { Pool } from 'pg';

export function createDatabase(connectionString: string): Pool {
  return new Pool({ connectionString, max: 5 });
}
