import { asc, count, eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { chatGroups, chats } from '../db/schema.js';

export interface ChatGroup extends InferSelectModel<typeof chatGroups> {}

export interface ChatGroupWithCount extends ChatGroup {
  chatCount: number;
}

export class ChatGroupRepository {
  constructor() {}

  async getAllGroups(): Promise<ChatGroup[]> {
    return getDb().select().from(chatGroups).orderBy(asc(chatGroups.name));
  }

  async getAllGroupsWithChatCounts(): Promise<ChatGroupWithCount[]> {
    const rows = await getDb()
      .select({
        id: chatGroups.id,
        name: chatGroups.name,
        createdAt: chatGroups.createdAt,
        updatedAt: chatGroups.updatedAt,
        chatCount: count(chats.id),
      })
      .from(chatGroups)
      .leftJoin(chats, eq(chats.groupId, chatGroups.id))
      .groupBy(chatGroups.id)
      .orderBy(asc(chatGroups.name));

    return rows.map((row) => ({ ...row, chatCount: Number(row.chatCount) }));
  }

  async getGroupById(id: number): Promise<ChatGroup | null> {
    const rows = await getDb().select().from(chatGroups).where(eq(chatGroups.id, id)).limit(1);
    return rows[0] ?? null;
  }

  async findByName(name: string): Promise<ChatGroup | null> {
    const rows = await getDb().select().from(chatGroups).where(eq(chatGroups.name, name)).limit(1);
    return rows[0] ?? null;
  }

  async createGroup(name: string): Promise<number> {
    const rows = await getDb()
      .insert(chatGroups)
      .values({ name })
      .returning({ id: chatGroups.id });

    return rows[0].id;
  }

  async getOrCreateGroup(name: string): Promise<ChatGroup> {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Group name is required');
    }

    const existing = await this.findByName(trimmed);
    if (existing) return existing;

    const id = await this.createGroup(trimmed);
    const created = await this.getGroupById(id);
    if (!created) {
      throw new Error('Group creation failed');
    }

    return created;
  }

  async renameGroup(id: number, name: string): Promise<void> {
    await getDb()
      .update(chatGroups)
      .set({ name: name.trim(), updatedAt: new Date().toISOString() })
      .where(eq(chatGroups.id, id));
  }

  async deleteGroup(id: number): Promise<void> {
    await getDb().transaction(async (tx) => {
      await tx.update(chats).set({ groupId: null }).where(eq(chats.groupId, id));
      await tx.delete(chatGroups).where(eq(chatGroups.id, id));
    });
  }
}
