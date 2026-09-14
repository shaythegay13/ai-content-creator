import { getDb } from '../db/client';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
if (process.argv.includes('--production')) {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
  await migrate(drizzle(neon(process.env.DATABASE_URL)), {
    migrationsFolder: 'drizzle',
  });
  console.log('Production migrations applied. No sample data was inserted.');
} else {
  process.env.LOCAL_DEV_MODE = 'true';
  await getDb();
  console.log(
    'Local PostgreSQL migrations and idempotent sample seed are ready.',
  );
}
process.exit(0);
