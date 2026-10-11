import { BaseEntity, BaseRepository } from '../core/repository.js';
import { SQLiteDatabase } from '../core/database.js';

export interface LookALikeUser extends BaseEntity {
  chatSeen: string;
  chatId: number;
  peerId: number;
  name: string;
  username?: string;
}

export class LookALikeUserRepository extends BaseRepository<LookALikeUser> {
  constructor(db: SQLiteDatabase) {
    super(db, 'lookalike_users');
  }

  async findByPeerId(peerId: number): Promise<LookALikeUser | null> {
    return this.findOneBy({ peerId });
  }

  async findByChatId(chatId: number, limit?: number): Promise<LookALikeUser[]> {
    return this.findManyBy({ chatId } as Partial<LookALikeUser>, limit);
  }

  async findByUsername(username: string): Promise<LookALikeUser | null> {
    return this.findOneBy({ username } as Partial<LookALikeUser>);
  }

  async findByChatAndPeer(chatId: number, peerId: number): Promise<LookALikeUser | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE chatId = ? AND peerId = ? LIMIT 1`;
    return this.db.queryOne<LookALikeUser>(sql, [chatId, peerId]);
  }

  async createOrUpdate(user: Omit<LookALikeUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const existing = await this.findByChatAndPeer(user.chatId, user.peerId);

    if (existing) {
      await this.update(existing.id!, {
        chatSeen: user.chatSeen,
        name: user.name,
        username: user.username,
      });
      return existing.id!;
    }

    return this.create(user);
  }

  async getUsersSeenAfter(date: string, chatId?: number): Promise<LookALikeUser[]> {
    let sql = `SELECT * FROM ${this.tableName} WHERE chatSeen > ?`;
    const params: any[] = [date];

    if (chatId) {
      sql += ` AND chatId = ?`;
      params.push(chatId);
    }

    return this.db.query<LookALikeUser>(sql, params);
  }

  async getUniqueUsersByChat(chatId: number): Promise<LookALikeUser[]> {
    return this.findByChatId(chatId);
  }

  async deleteByChatId(chatId: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE chatId = ?`;
    this.db.execute(sql, [chatId]);
  }

  async getAll(limit?: number): Promise<LookALikeUser[]> {
    return this.findAll(limit);
  }
}
