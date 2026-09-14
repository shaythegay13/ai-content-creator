import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { drizzle as neonDrizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import * as schema from './schema';
import { isLocalMode } from '../lib/config';
import { seed } from './seed';
export type Database = ReturnType<typeof drizzle<typeof schema>>;
const globalDb = globalThis as unknown as { contentDb?: Promise<Database> };
export async function getDb(): Promise<Database> {
  if (!globalDb.contentDb) globalDb.contentDb = initialize();
  return globalDb.contentDb;
}
async function initialize(): Promise<Database> {
  if (!isLocalMode()) {
    if (!process.env.DATABASE_URL)
      throw new Error(
        'Configure DATABASE_URL or run locally with LOCAL_DEV_MODE=true.',
      );
    // Both adapters implement the same PostgreSQL query-builder surface used by services.
    return neonDrizzle(neon(process.env.DATABASE_URL), {
      schema,
    }) as unknown as Database;
  }
  const directory = path.resolve(
    process.env.LOCAL_DATA_DIR || '.local',
    'postgres',
  );
  await mkdir(directory, { recursive: true });
  const db = drizzle(new PGlite(directory), { schema });
  await migrate(db, { migrationsFolder: path.resolve('drizzle') });
  await seed(db);
  return db;
}
