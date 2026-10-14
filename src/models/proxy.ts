import { count, eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { proxies } from '../db/schema.js';

export const PROXY_TYPES = ['https', 'socks5'] as const;
export type ProxyType = (typeof PROXY_TYPES)[number];

export interface Proxy extends InferSelectModel<typeof proxies> {
  type: ProxyType;
}

export type ProxyCreate = Omit<Proxy, 'id' | 'createdAt' | 'updatedAt'>;
export type ProxyUpdate = Partial<ProxyCreate>;

export interface MtProxySettings {
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export class ProxyRepository {
  constructor() {}

  async getAllProxies(): Promise<Proxy[]> {
    const rows = await getDb().select().from(proxies).orderBy(proxies.id);
    return rows as Proxy[];
  }

  async getProxyById(id: number): Promise<Proxy | null> {
    const rows = await getDb().select().from(proxies).where(eq(proxies.id, id)).limit(1);
    const row = rows[0];
    return row ? (row as Proxy) : null;
  }

  async findByName(name: string): Promise<Proxy | null> {
    const rows = await getDb().select().from(proxies).where(eq(proxies.name, name)).limit(1);
    const row = rows[0];
    return row ? (row as Proxy) : null;
  }

  async createProxy(data: ProxyCreate): Promise<number> {
    const rows = await getDb()
      .insert(proxies)
      .values({
        type: data.type,
        name: data.name,
        host: data.host,
        port: data.port,
        rotationUrl: data.rotationUrl ?? null,
        username: data.username,
        password: data.password,
      })
      .returning({ id: proxies.id });

    return rows[0].id;
  }

  async updateProxy(id: number, updates: ProxyUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const data = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<ProxyCreate>;

    await getDb()
      .update(proxies)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(proxies.id, id));
  }

  async deleteById(id: number): Promise<void> {
    await getDb().delete(proxies).where(eq(proxies.id, id));
  }

  async countAll(): Promise<number> {
    const result = await getDb().select({ count: count() }).from(proxies);
    return Number(result[0]?.count ?? 0);
  }

  /** Settings in the shape mtcute transports expect. */
  static forClient(proxy: Proxy): MtProxySettings {
    return {
      host: proxy.host,
      port: proxy.port,
      username: proxy.username ?? undefined,
      password: proxy.password ?? undefined,
    };
  }
}
