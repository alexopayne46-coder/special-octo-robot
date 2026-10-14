import { Database } from 'bun:sqlite';
import { getDb, runMigrations, closeDb } from '../src/db/client.js';
import { users, lookalikeUsers, chats, chatGroups, adCampaigns, campaignArtifacts } from '../src/db/schema.js';

const SQLITE_PATH = process.argv[2] ?? './data/app.db';
const FORCE = process.argv.includes('--force');
const CHUNK = 500;

interface TableConfig {
  drizzleTable: any;
  name: string;
  jsonColumns?: string[];
}

const tables: TableConfig[] = [
  { drizzleTable: users, name: 'users' },
  { drizzleTable: chats, name: 'chats' },
  { drizzleTable: chatGroups, name: 'chat_groups' },
  { drizzleTable: adCampaigns, name: 'ad_campaigns', jsonColumns: ['time', 'payload', 'addressesForCampaign'] },
  { drizzleTable: campaignArtifacts, name: 'campaign_artifacts', jsonColumns: ['payload'] },
  { drizzleTable: lookalikeUsers, name: 'lookalike_users' },
];

function transformRow(row: Record<string, any>, jsonColumns: string[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(row)) {
    if (jsonColumns.includes(key) && typeof value === 'string') {
      try {
        out[key] = JSON.parse(value);
        continue;
      } catch {
        out[key] = value;
        continue;
      }
    }
    out[key] = value ?? null;
  }
  return out;
}

async function resetSequence(db: any, table: string): Promise<void> {
  await db.execute(
    `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 0) + 1, (SELECT MAX(id) IS NOT NULL FROM "${table}"))`
  );
}

const sqlite = new Database(SQLITE_PATH, { readonly: true });
await runMigrations();
const db = getDb();

const tableNames = tables.map((t) => `"${t.name}"`).join(', ');
const existing = await db.execute<{ count: number }>(
  `SELECT (${tables.map((t) => `(SELECT COUNT(*) FROM "${t.name}")`).join(' + ')})::int AS count`
);
const existingCount = Number(existing.rows[0]?.count ?? 0);

if (existingCount > 0 && !FORCE) {
  console.error(`Target PostgreSQL already holds ${existingCount} rows. Re-run with --force to overwrite.`);
  sqlite.close();
  await closeDb();
  process.exit(1);
}

if (existingCount > 0) {
  await db.execute(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY`);
  console.log(`Truncated existing PostgreSQL data (${existingCount} rows)`);
}

let totalRows = 0;

for (const { drizzleTable, name, jsonColumns = [] } of tables) {
  const rows = sqlite.query(`SELECT * FROM ${name}`).all() as Record<string, any>[];
  console.log(`${name}: ${rows.length} rows`);

  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK).map((row) => transformRow(row, jsonColumns));
    await db.insert(drizzleTable).values(batch);
    totalRows += batch.length;
  }

  await resetSequence(db, name);
}

console.log(`Migrated ${totalRows} rows from ${SQLITE_PATH} to PostgreSQL`);
sqlite.close();
await closeDb();
