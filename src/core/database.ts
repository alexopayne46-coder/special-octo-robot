import { Database } from 'bun:sqlite';
import { logger } from './logger.js';

export interface DatabaseConfig {
  path: string;
  readonly?: boolean;
  create?: boolean;
}

export class SQLiteDatabase {
  private db: Database;
  private config: DatabaseConfig;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.db = new Database(config.path, {
      readonly: config.readonly ?? false,
      create: config.create ?? true,
    });
    logger.info(`SQLite database initialized at ${config.path}`);
  }

  query<T = any>(sql: string, params?: any[]): T[] {
    try {
      const stmt = this.db.query(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (error) {
      logger.error(`Query failed: ${error}`);
      throw error;
    }
  }

  queryOne<T = any>(sql: string, params?: any[]): T | null {
    try {
      const stmt = this.db.query(sql);
      const result = params ? stmt.get(...params) : stmt.get();
      return result as T | null;
    } catch (error) {
      logger.error(`Query failed: ${error}`);
      throw error;
    }
  }

  execute(sql: string, params?: any[]): void {
    try {
      const stmt = this.db.query(sql);
      if (params) {
        stmt.run(...params);
      } else {
        stmt.run();
      }
    } catch (error) {
      logger.error(`Execute failed: ${error}`);
      throw error;
    }
  }

  executeTransaction(operations: (() => void)[]): void {
    try {
      this.db.exec('BEGIN TRANSACTION');
      for (const op of operations) {
        op();
      }
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      logger.error(`Transaction failed: ${error}`);
      throw error;
    }
  }

  close(): void {
    this.db.close();
    logger.info('SQLite database closed');
  }

  getDatabase(): Database {
    return this.db;
  }
}

export class DatabaseManager {
  private static instance: DatabaseManager;
  private databases: Map<string, SQLiteDatabase> = new Map();

  private constructor() {}

  public static getInstance(): DatabaseManager {
    if (!DatabaseManager.instance) {
      DatabaseManager.instance = new DatabaseManager();
    }
    return DatabaseManager.instance;
  }

  public registerDatabase(name: string, config: DatabaseConfig): SQLiteDatabase {
    if (this.databases.has(name)) {
      logger.warn(`Database ${name} already registered, returning existing instance`);
      return this.databases.get(name)!;
    }

    const db = new SQLiteDatabase(config);
    this.databases.set(name, db);
    logger.info(`Database ${name} registered`);
    return db;
  }

  public getDatabase(name: string): SQLiteDatabase | undefined {
    return this.databases.get(name);
  }

  public closeDatabase(name: string): void {
    const db = this.databases.get(name);
    if (db) {
      db.close();
      this.databases.delete(name);
      logger.info(`Database ${name} closed and unregistered`);
    }
  }

  public closeAll(): void {
    for (const [name, db] of this.databases) {
      db.close();
      logger.info(`Database ${name} closed`);
    }
    this.databases.clear();
  }
}

export const $dbManager = DatabaseManager.getInstance();
