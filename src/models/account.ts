import { eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { accounts, proxies } from '../db/schema.js';

export interface Account extends InferSelectModel<typeof accounts> {}

export type AccountCreate = Omit<Account, 'id' | 'createdAt' | 'updatedAt'>;
export type AccountUpdate = Partial<AccountCreate>;

/** Account joined with its proxy (password never leaves the database). */
export interface AccountWithProxy extends Account {
  proxy: {
    id: number;
    name: string;
    type: string;
    host: string;
    port: number;
    username: string | null;
  } | null;
}

export class AccountRepository {
  async getAllAccounts(): Promise<AccountWithProxy[]> {
    const rows = await getDb()
      .select({
        id: accounts.id,
        name: accounts.name,
        address: accounts.address,
        tdataPath: accounts.tdataPath,
        proxyId: accounts.proxyId,
        enabled: accounts.enabled,
        createdAt: accounts.createdAt,
        updatedAt: accounts.updatedAt,
        proxy: {
          id: proxies.id,
          name: proxies.name,
          type: proxies.type,
          host: proxies.host,
          port: proxies.port,
          username: proxies.username,
        },
      })
      .from(accounts)
      .leftJoin(proxies, eq(accounts.proxyId, proxies.id))
      .orderBy(accounts.id);

    return rows as AccountWithProxy[];
  }

  async getAccountById(id: number): Promise<AccountWithProxy | null> {
    const rows = await this.getAllAccounts();
    return rows.find((account) => account.id === id) ?? null;
  }

  async findByName(name: string): Promise<Account | null> {
    const rows = await getDb().select().from(accounts).where(eq(accounts.name, name)).limit(1);
    return rows[0] ?? null;
  }

  async getEnabledAccounts(): Promise<Account[]> {
    const rows = await getDb().select().from(accounts).where(eq(accounts.enabled, true));
    return rows;
  }

  async createAccount(data: AccountCreate): Promise<number> {
    const rows = await getDb()
      .insert(accounts)
      .values({
        name: data.name,
        address: data.address,
        tdataPath: data.tdataPath ?? null,
        proxyId: data.proxyId ?? null,
        enabled: data.enabled ?? true,
      })
      .returning({ id: accounts.id });

    return rows[0].id;
  }

  /** Insert the account, or refresh the row if it was already registered. */
  async registerAccount(
    name: string,
    address: string,
    tdataPath: string | null,
    proxyId: number | null
  ): Promise<number> {
    const existing = await this.findByName(name);
    if (existing) {
      await this.updateAccount(existing.id, {
        address,
        tdataPath: tdataPath ?? existing.tdataPath,
        proxyId,
      });
      return existing.id;
    }

    return this.createAccount({ name, address, tdataPath, proxyId, enabled: true });
  }

  async updateAccount(id: number, updates: AccountUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const data = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<AccountCreate>;

    await getDb()
      .update(accounts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(accounts.id, id));
  }

  async deleteById(id: number): Promise<void> {
    await getDb().delete(accounts).where(eq(accounts.id, id));
  }

  async countAll(): Promise<number> {
    const rows = await getDb().select({ c: accounts.id }).from(accounts);
    return rows.length;
  }
}
