import { BaseEntity, BaseRepository } from '../core/repository.js';
import { SQLiteDatabase } from '../core/database.js';

export interface Chat extends BaseEntity {
  peerId: number | null;
  title: string | null;
  username: string | null;
  groupId: number | null;
}

export class ChatRepository extends BaseRepository<Chat> {
  constructor(db: SQLiteDatabase) {
    super(db, 'chats');
  }

  async findByPeerId(peerId: number): Promise<Chat | null> {
    return this.findOneBy({ peerId } as Partial<Chat>);
  }

  async findByUsername(username: string): Promise<Chat | null> {
    return this.findOneBy({ username } as Partial<Chat>);
  }

  async findByTitle(title: string): Promise<Chat[]> {
    return this.findManyBy({ title } as Partial<Chat>);
  }

  async getAllChats(limit?: number): Promise<Chat[]> {
    return this.findAll(limit);
  }

  async createOrUpdate(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    if (chat.peerId) {
      const existing = await this.findByPeerId(chat.peerId);

      if (existing) {
        await this.update(existing.id!, {
          title: chat.title,
          username: chat.username,
          groupId: chat.groupId ?? existing.groupId,
        });
        return existing.id!;
      }
    }

    return this.create(chat);
  }

  async assignToGroup(id: number, groupId: number | null): Promise<void> {
    await this.update(id, { groupId });
  }

  async getByGroup(groupId: number): Promise<Chat[]> {
    return this.findManyBy({ groupId } as Partial<Chat>);
  }

  async updateById(id: number, updates: Partial<Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    await this.update(id, updates);
  }

  async deleteById(id: number): Promise<void> {
    await this.delete(id);
  }

  async deleteByPeerId(peerId: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE peerId = ?`;
    this.db.execute(sql, [peerId]);
  }

  async deleteByUsername(username: string): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE username = ?`;
    this.db.execute(sql, [username]);
  }

  async countAll(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const result = await this.db.queryOne<{ count: number }>(sql, []);
    return result?.count || 0;
  }

  async searchByKeyword(keyword: string): Promise<Chat[]> {
    const sql = `SELECT * FROM ${this.tableName} WHERE title LIKE ? OR username LIKE ?`;
    const pattern = `%${keyword}%`;
    return this.db.query<Chat>(sql, [pattern, pattern]);
  }

  async deleteAll(): Promise<void> {
    const sql = `DELETE FROM ${this.tableName}`;
    this.db.execute(sql);
  }
}
