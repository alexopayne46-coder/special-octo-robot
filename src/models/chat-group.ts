import { BaseEntity, BaseRepository } from '../core/repository.js';
import { SQLiteDatabase } from '../core/database.js';

export interface ChatGroup extends BaseEntity {
  name: string;
}

export interface ChatGroupWithCount extends ChatGroup {
  chatCount: number;
}

export class ChatGroupRepository extends BaseRepository<ChatGroup> {
  constructor(db: SQLiteDatabase) {
    super(db, 'chat_groups');
  }

  async getAllGroups(): Promise<ChatGroup[]> {
    const sql = `SELECT * FROM ${this.tableName} ORDER BY name ASC`;
    return this.db.query<ChatGroup>(sql);
  }

  async getAllGroupsWithChatCounts(): Promise<ChatGroupWithCount[]> {
    const sql = `
      SELECT g.*, COUNT(c.id) AS chatCount
      FROM ${this.tableName} g
      LEFT JOIN chats c ON c.groupId = g.id
      GROUP BY g.id
      ORDER BY g.name ASC
    `;
    return this.db.query<ChatGroupWithCount>(sql);
  }

  async getGroupById(id: number): Promise<ChatGroup | null> {
    return this.findOneBy({ id } as Partial<ChatGroup>);
  }

  async findByName(name: string): Promise<ChatGroup | null> {
    return this.findOneBy({ name } as Partial<ChatGroup>);
  }

  async createGroup(name: string): Promise<number> {
    const now = new Date().toISOString();
    const sql = `INSERT INTO ${this.tableName} (name, createdAt, updatedAt) VALUES (?, ?, ?)`;
    this.db.execute(sql, [name, now, now]);
    return this.lastInsertId();
  }

  async getOrCreateGroup(name: string): Promise<ChatGroup> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Group name is required');
    }

    const existing = await this.findByName(trimmed);
    if (existing) return existing;

    const id = await this.createGroup(trimmed);
    return { id, name: trimmed };
  }

  async renameGroup(id: number, name: string): Promise<void> {
    await this.update(id, { name: name.trim() });
  }

  async deleteGroup(id: number): Promise<void> {
    const detachSql = `UPDATE chats SET groupId = NULL WHERE groupId = ?`;
    this.db.execute(detachSql, [id]);
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    this.db.execute(sql, [id]);
  }

  private async lastInsertId(): Promise<number> {
    const result = await this.db.queryOne<{ rowid: number }>('SELECT last_insert_rowid() AS rowid', [])
    return result?.rowid ?? 0
  }
}
