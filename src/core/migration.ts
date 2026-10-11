import { SQLiteDatabase } from './database.js';
import { logger } from './logger.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: SQLiteDatabase) => void | Promise<void>;
  down?: (db: SQLiteDatabase) => void | Promise<void>;
}

export class MigrationRunner {
  private migrations: Migration[] = [];
  private versionTable = '_migrations';

  constructor(private db: SQLiteDatabase) {
    this.ensureVersionTable();
  }

  private ensureVersionTable(): void {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.versionTable} (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `;
    this.db.execute(sql);
  }

  registerMigration(migration: Migration): void {
    this.migrations.push(migration);
    this.migrations.sort((a, b) => a.version - b.version);
  }

  async migrateTo(targetVersion?: number): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    const target = targetVersion ?? this.getLatestVersion();

    logger.info(`Migrating from version ${currentVersion} to ${target}`);

    if (target > currentVersion) {
      await this.migrateUp(currentVersion, target);
    } else if (target < currentVersion) {
      await this.migrateDown(currentVersion, target);
    } else {
      logger.info('Already at target version');
    }
  }

  private async migrateUp(from: number, to: number): Promise<void> {
    const toApply = this.migrations.filter((m) => m.version > from && m.version <= to);

    for (const migration of toApply) {
      logger.info(`Applying migration ${migration.version}: ${migration.name}`);
      await migration.up(this.db);
      this.recordMigration(migration);
      logger.info(`Migration ${migration.version} applied successfully`);
    }
  }

  private async migrateDown(from: number, to: number): Promise<void> {
    const toRollback = this.migrations
      .filter((m) => m.version > to && m.version <= from)
      .sort((a, b) => b.version - a.version);

    for (const migration of toRollback) {
      if (!migration.down) {
        logger.warn(`Migration ${migration.version} does not have a down migration, skipping`);
        continue;
      }

      logger.info(`Rolling back migration ${migration.version}: ${migration.name}`);
      await migration.down(this.db);
      this.removeMigration(migration.version);
      logger.info(`Migration ${migration.version} rolled back successfully`);
    }
  }

  private recordMigration(migration: Migration): void {
    const sql = `
      INSERT INTO ${this.versionTable} (version, name, applied_at)
      VALUES (?, ?, ?)
    `;
    this.db.execute(sql, [migration.version, migration.name, new Date().toISOString()]);
  }

  private removeMigration(version: number): void {
    const sql = `DELETE FROM ${this.versionTable} WHERE version = ?`;
    this.db.execute(sql, [version]);
  }

  private async getCurrentVersion(): Promise<number> {
    const sql = `SELECT MAX(version) as version FROM ${this.versionTable}`;
    const result = this.db.queryOne<{ version: number | null }>(sql);
    return result?.version ?? 0;
  }

  private getLatestVersion(): number {
    return this.migrations.length > 0 ? this.migrations[this.migrations.length - 1].version : 0;
  }

  getAppliedMigrations(): Array<{ version: number; name: string; applied_at: string }> {
    const sql = `SELECT version, name, applied_at FROM ${this.versionTable} ORDER BY version ASC`;
    return this.db.query(sql);
  }

  getPendingMigrations(): Migration[] {
    const applied = this.getAppliedMigrations().map((m) => m.version);
    return this.migrations.filter((m) => !applied.includes(m.version));
  }
}

export class SchemaBuilder {
  constructor(private db: SQLiteDatabase) {}

  createTable(name: string, definition: string): void {
    const sql = `CREATE TABLE IF NOT EXISTS ${name} (${definition})`;
    this.db.execute(sql);
  }

  dropTable(name: string): void {
    const sql = `DROP TABLE IF EXISTS ${name}`;
    this.db.execute(sql);
  }

  addColumn(table: string, column: string, definition: string): void {
    const sql = `ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`;
    this.db.execute(sql);
  }

  hasColumn(table: string, column: string): boolean {
    const columns = this.db.query<{ name: string }>(`PRAGMA table_info(${table})`);
    return columns.some((c) => c.name === column);
  }

  dropColumn(table: string, column: string): void {
    const sql = `ALTER TABLE ${table} DROP COLUMN ${column}`;
    this.db.execute(sql);
  }

  createIndex(table: string, name: string, columns: string, unique: boolean = false): void {
    const uniqueStr = unique ? 'UNIQUE ' : '';
    const sql = `CREATE ${uniqueStr}INDEX IF NOT EXISTS ${name} ON ${table} (${columns})`;
    this.db.execute(sql);
  }

  dropIndex(name: string): void {
    const sql = `DROP INDEX IF EXISTS ${name}`;
    this.db.execute(sql);
  }
}
