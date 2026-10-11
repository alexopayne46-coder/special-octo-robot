import { SQLiteDatabase } from './database.js';
import { logger } from './logger.js';

export interface BaseEntity {
  id?: number;
  createdAt?: string;
  updatedAt?: string;
}

export abstract class BaseRepository<T extends BaseEntity> {
  constructor(protected db: SQLiteDatabase, protected tableName: string) {}

  protected async findOneBy(where: Partial<T>): Promise<T | null> {
    const conditions = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(where);

    const sql = `SELECT * FROM ${this.tableName} WHERE ${conditions} LIMIT 1`;
    return this.db.queryOne<T>(sql, values);
  }

  protected async findManyBy(where: Partial<T>, limit?: number): Promise<T[]> {
    const conditions = Object.keys(where)
      .map((key) => `${key} = ?`)
      .join(' AND ');
    const values = Object.values(where);

    let sql = `SELECT * FROM ${this.tableName} WHERE ${conditions}`;
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }

    return this.db.query<T>(sql, values);
  }

  protected async findAll(limit?: number): Promise<T[]> {
    let sql = `SELECT * FROM ${this.tableName}`;
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    return this.db.query<T>(sql);
  }

  protected async create(data: Omit<T, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const now = new Date().toISOString();
    const fields = Object.keys(data);
    const placeholders = fields.map(() => '?').join(', ');
    const values = [...Object.values(data), now, now];

    const sql = `
      INSERT INTO ${this.tableName} (${fields.join(', ')}, createdAt, updatedAt)
      VALUES (${placeholders}, ?, ?)
    `;

    this.db.execute(sql, values);
    const lastId = this.db.getDatabase().lastInsertRowId;
    return typeof lastId === 'bigint' ? Number(lastId) : (lastId as number);
  }

  protected async update(id: number, data: Partial<Omit<T, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const now = new Date().toISOString();
    const fields = Object.keys(data);
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = [...Object.values(data), now, id];

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}, updatedAt = ?
      WHERE id = ?
    `;

    this.db.execute(sql, values);
  }

  protected async delete(id: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    this.db.execute(sql, [id]);
  }

  protected async count(where?: Partial<T>): Promise<number> {
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    let values: any[] = [];

    if (where && Object.keys(where).length > 0) {
      const conditions = Object.keys(where)
        .map((key) => `${key} = ?`)
        .join(' AND ');
      values = Object.values(where);
      sql += ` WHERE ${conditions}`;
    }

    const result = this.db.queryOne<{ count: number }>(sql, values);
    return result?.count ?? 0;
  }

  protected async exists(where: Partial<T>): Promise<boolean> {
    const count = await this.count(where);
    return count > 0;
  }
}

export class QueryBuilder {
  private select: string[] = ['*'];
  private where: string[] = [];
  private whereParams: any[] = [];
  private orderBy?: string;
  private limit?: number;
  private offset?: number;

  constructor(private db: SQLiteDatabase, private tableName: string) {}

  selectFields(fields: string[]): this {
    this.select = fields;
    return this;
  }

  whereCondition(condition: string, params: any[] = []): this {
    this.where.push(condition);
    this.whereParams.push(...params);
    return this;
  }

  whereEqual(field: string, value: any): this {
    this.where.push(`${field} = ?`);
    this.whereParams.push(value);
    return this;
  }

  whereIn(field: string, values: any[]): this {
    const placeholders = values.map(() => '?').join(', ');
    this.where.push(`${field} IN (${placeholders})`);
    this.whereParams.push(...values);
    return this;
  }

  orderByField(field: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderBy = `${field} ${direction}`;
    return this;
  }

  setLimit(limit: number): this {
    this.limit = limit;
    return this;
  }

  setOffset(offset: number): this {
    this.offset = offset;
    return this;
  }

  build(): string {
    let sql = `SELECT ${this.select.join(', ')} FROM ${this.tableName}`;

    if (this.where.length > 0) {
      sql += ` WHERE ${this.where.join(' AND ')}`;
    }

    if (this.orderBy) {
      sql += ` ORDER BY ${this.orderBy}`;
    }

    if (this.limit) {
      sql += ` LIMIT ${this.limit}`;
    }

    if (this.offset) {
      sql += ` OFFSET ${this.offset}`;
    }

    return sql;
  }

  execute<T = any>(): T[] {
    const sql = this.build();
    return this.db.query<T>(sql, this.whereParams);
  }

  executeOne<T = any>(): T | null {
    const sql = this.build();
    return this.db.queryOne<T>(sql, this.whereParams);
  }

  reset(): this {
    this.select = ['*'];
    this.where = [];
    this.whereParams = [];
    this.orderBy = undefined;
    this.limit = undefined;
    this.offset = undefined;
    return this;
  }
}
