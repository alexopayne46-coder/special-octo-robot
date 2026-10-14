import { migrate as runDrizzleMigrations } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DATABASE_URL } from '../config.js';
import { logger } from '../core/logger.js';

export type AppDatabase = NodePgDatabase;

let pool: Pool | null = null;
let db: AppDatabase | null = null;

export function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected error on idle PostgreSQL client');
    });
    logger.info({ url: redactUrl(DATABASE_URL) }, 'PostgreSQL pool created');
  }
  return pool;
}

export function getDb(): AppDatabase {
  if (!db) {
    db = drizzle({ client: getPool() });
    logger.info('Drizzle database initialized');
  }
  return db;
}

export async function runMigrations(migrationsFolder = './drizzle'): Promise<void> {
  await runDrizzleMigrations(getDb(), { migrationsFolder });
  logger.info({ migrationsFolder }, 'Database migrations applied');
}

export async function closeDb(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    db = null;
    logger.info('PostgreSQL pool closed');
  }
}

function redactUrl(url: string): string {
  return url.replace(/:\/\/([^:]+):[^@]+@/, '://$1:***@');
}
