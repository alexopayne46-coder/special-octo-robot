import { count, eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { adCampaigns } from '../db/schema.js';

export type { AdCampaignTime, AdCampaignPayload } from '../db/schema.js';

export const CAMPAIGN_TYPES = ['SPM::SendToChats', 'Common::common'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'completed', 'failed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_CREATE_STATUSES = ['draft', 'scheduled'] as const;
export type CampaignCreateStatus = (typeof CAMPAIGN_CREATE_STATUSES)[number];

export interface AdCampaign extends InferSelectModel<typeof adCampaigns> {
  campaignType: CampaignType;
  status: CampaignStatus;
}

export type AdCampaignCreate = Omit<AdCampaign, 'id' | 'createdAt' | 'updatedAt'>;
export type AdCampaignUpdate = Partial<AdCampaignCreate>;

export class AdCampaignRepository {
  constructor() {}

  async getAllCampaigns(limit?: number): Promise<AdCampaign[]> {
    const query = getDb().select().from(adCampaigns);
    const rows = limit ? await query.limit(limit) : await query;
    return rows as AdCampaign[];
  }

  async getCampaignById(id: number): Promise<AdCampaign | null> {
    const rows = await getDb().select().from(adCampaigns).where(eq(adCampaigns.id, id)).limit(1);
    const row = rows[0];
    return row ? (row as AdCampaign) : null;
  }

  async findByStatus(status: CampaignStatus): Promise<AdCampaign[]> {
    const rows = await getDb().select().from(adCampaigns).where(eq(adCampaigns.status, status));
    return rows as AdCampaign[];
  }

  async createCampaign(data: AdCampaignCreate): Promise<number> {
    const rows = await getDb()
      .insert(adCampaigns)
      .values({
        name: data.name,
        time: data.time ?? { asFastAsPossible: true },
        payload: data.payload ?? {},
        campaignType: data.campaignType,
        status: data.status,
        addressesForCampaign: data.addressesForCampaign ?? [],
      })
      .returning({ id: adCampaigns.id });

    return rows[0].id;
  }

  async updateCampaign(id: number, updates: AdCampaignUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const data = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<AdCampaignCreate>;

    await getDb()
      .update(adCampaigns)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(adCampaigns.id, id));
  }

  async deleteById(id: number): Promise<void> {
    await getDb().delete(adCampaigns).where(eq(adCampaigns.id, id));
  }

  async deleteAll(): Promise<void> {
    await getDb().delete(adCampaigns);
  }

  async updateStatus(id: number, status: CampaignStatus): Promise<void> {
    await this.updateCampaign(id, { status });
  }

  async countAll(): Promise<number> {
    const result = await getDb().select({ count: count() }).from(adCampaigns);
    return Number(result[0]?.count ?? 0);
  }
}
