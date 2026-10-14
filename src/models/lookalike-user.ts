import { and, eq, gt, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { lookalikeUsers } from '../db/schema.js';

export interface LookALikeUser extends InferSelectModel<typeof lookalikeUsers> {}

export class LookALikeUserRepository {
  constructor() {}

  async findByPeerId(peerId: number): Promise<LookALikeUser | null> {
    const rows = await getDb()
      .select()
      .from(lookalikeUsers)
      .where(eq(lookalikeUsers.peerId, peerId))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByChatId(chatId: number, limit?: number): Promise<LookALikeUser[]> {
    const query = getDb().select().from(lookalikeUsers).where(eq(lookalikeUsers.chatId, chatId));
    return limit ? query.limit(limit) : query;
  }

  async findByUsername(username: string): Promise<LookALikeUser | null> {
    const rows = await getDb()
      .select()
      .from(lookalikeUsers)
      .where(eq(lookalikeUsers.username, username))
      .limit(1);
    return rows[0] ?? null;
  }

  async findByChatAndPeer(chatId: number, peerId: number): Promise<LookALikeUser | null> {
    const rows = await getDb()
      .select()
      .from(lookalikeUsers)
      .where(and(eq(lookalikeUsers.chatId, chatId), eq(lookalikeUsers.peerId, peerId)))
      .limit(1);
    return rows[0] ?? null;
  }

  async createOrUpdate(user: Omit<LookALikeUser, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    const rows = await getDb()
      .insert(lookalikeUsers)
      .values({
        chatSeen: user.chatSeen,
        chatId: user.chatId,
        peerId: user.peerId,
        name: user.name,
        username: user.username ?? null,
      })
      .onConflictDoUpdate({
        target: [lookalikeUsers.chatId, lookalikeUsers.peerId],
        set: {
          chatSeen: user.chatSeen,
          name: user.name,
          username: user.username ?? null,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning({ id: lookalikeUsers.id });

    return rows[0].id;
  }

  async getUsersSeenAfter(date: string, chatId?: number): Promise<LookALikeUser[]> {
    const conditions = [gt(lookalikeUsers.chatSeen, date)];
    if (chatId) {
      conditions.push(eq(lookalikeUsers.chatId, chatId));
    }

    return getDb().select().from(lookalikeUsers).where(and(...conditions));
  }

  async getUniqueUsersByChat(chatId: number): Promise<LookALikeUser[]> {
    return this.findByChatId(chatId);
  }

  async deleteByChatId(chatId: number): Promise<void> {
    await getDb().delete(lookalikeUsers).where(eq(lookalikeUsers.chatId, chatId));
  }

  async getAll(limit?: number): Promise<LookALikeUser[]> {
    const query = getDb().select().from(lookalikeUsers);
    return limit ? query.limit(limit) : query;
  }
}
