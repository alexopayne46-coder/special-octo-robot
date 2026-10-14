import { count, eq, like, or, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { chats } from '../db/schema.js';

export interface Chat extends InferSelectModel<typeof chats> {}

export class ChatRepository {
  constructor() {}

  async findByPeerId(peerId: number): Promise<Chat | null> {
    const rows = await getDb().select().from(chats).where(eq(chats.peerId, peerId)).limit(1);
    return rows[0] ?? null;
  }

  async findByUsername(username: string): Promise<Chat | null> {
    const rows = await getDb().select().from(chats).where(eq(chats.username, username)).limit(1);
    return rows[0] ?? null;
  }

  async findByTitle(title: string): Promise<Chat[]> {
    return getDb().select().from(chats).where(eq(chats.title, title));
  }

  async getAllChats(limit?: number): Promise<Chat[]> {
    const query = getDb().select().from(chats);
    return limit ? query.limit(limit) : query;
  }

  async createOrUpdate(chat: Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    if (chat.peerId) {
      const existing = await this.findByPeerId(chat.peerId);

      if (existing) {
        await getDb()
          .update(chats)
          .set({
            title: chat.title,
            username: chat.username,
            groupId: chat.groupId ?? existing.groupId,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(chats.id, existing.id));
        return existing.id;
      }
    }

    const rows = await getDb()
      .insert(chats)
      .values({
        peerId: chat.peerId,
        title: chat.title,
        username: chat.username,
        groupId: chat.groupId,
      })
      .returning({ id: chats.id });

    return rows[0].id;
  }

  async assignToGroup(id: number, groupId: number | null): Promise<void> {
    await getDb()
      .update(chats)
      .set({ groupId, updatedAt: new Date().toISOString() })
      .where(eq(chats.id, id));
  }

  async getByGroup(groupId: number): Promise<Chat[]> {
    return getDb().select().from(chats).where(eq(chats.groupId, groupId));
  }

  async updateById(id: number, updates: Partial<Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>>): Promise<void> {
    const data = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<Omit<Chat, 'id' | 'createdAt' | 'updatedAt'>>;

    await getDb()
      .update(chats)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(chats.id, id));
  }

  async deleteById(id: number): Promise<void> {
    await getDb().delete(chats).where(eq(chats.id, id));
  }

  async deleteByPeerId(peerId: number): Promise<void> {
    await getDb().delete(chats).where(eq(chats.peerId, peerId));
  }

  async deleteByUsername(username: string): Promise<void> {
    await getDb().delete(chats).where(eq(chats.username, username));
  }

  async countAll(): Promise<number> {
    const result = await getDb().select({ count: count() }).from(chats);
    return Number(result[0]?.count ?? 0);
  }

  async searchByKeyword(keyword: string): Promise<Chat[]> {
    const pattern = `%${keyword}%`;
    return getDb()
      .select()
      .from(chats)
      .where(or(like(chats.title, pattern), like(chats.username, pattern)));
  }

  async deleteAll(): Promise<void> {
    await getDb().delete(chats);
  }
}
