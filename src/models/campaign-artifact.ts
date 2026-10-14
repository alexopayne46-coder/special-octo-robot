import { asc, count, eq, type InferSelectModel } from 'drizzle-orm';
import { getDb } from '../db/client.js';
import { campaignArtifacts } from '../db/schema.js';

export const ARTIFACT_MOODS = ['positive', 'negative', 'neutral'] as const;
export type ArtifactMood = (typeof ARTIFACT_MOODS)[number];

export interface CampaignArtifact extends InferSelectModel<typeof campaignArtifacts> {
  mood: ArtifactMood;
}

export type CampaignArtifactCreate = Omit<CampaignArtifact, 'id' | 'createdAt' | 'updatedAt'>;

export type CampaignArtifactUpdate = Partial<CampaignArtifactCreate>;

export class CampaignArtifactRepository {
  constructor() {}

  async getByCampaign(campaignId: number, limit?: number): Promise<CampaignArtifact[]> {
    const query = getDb()
      .select()
      .from(campaignArtifacts)
      .where(eq(campaignArtifacts.campaignId, campaignId))
      .orderBy(asc(campaignArtifacts.id));

    const rows = limit === undefined ? await query : await query.limit(limit);
    return rows as CampaignArtifact[];
  }

  async getById(id: number): Promise<CampaignArtifact | null> {
    const rows = await getDb().select().from(campaignArtifacts).where(eq(campaignArtifacts.id, id)).limit(1);
    const row = rows[0];
    return row ? (row as CampaignArtifact) : null;
  }

  async createArtifact(data: CampaignArtifactCreate): Promise<number> {
    const rows = await getDb()
      .insert(campaignArtifacts)
      .values({
        campaignId: data.campaignId,
        text: data.text,
        mood: data.mood ?? 'neutral',
        payload: data.payload ?? {},
      })
      .returning({ id: campaignArtifacts.id });

    return rows[0].id;
  }

  async updateArtifact(id: number, updates: CampaignArtifactUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const data = Object.fromEntries(
      Object.entries(updates).filter(([, value]) => value !== undefined)
    ) as Partial<CampaignArtifactCreate>;

    await getDb()
      .update(campaignArtifacts)
      .set({ ...data, updatedAt: new Date().toISOString() })
      .where(eq(campaignArtifacts.id, id));
  }

  async deleteByCampaign(campaignId: number): Promise<void> {
    await getDb().delete(campaignArtifacts).where(eq(campaignArtifacts.campaignId, campaignId));
  }

  async deleteById(id: number): Promise<void> {
    await getDb().delete(campaignArtifacts).where(eq(campaignArtifacts.id, id));
  }

  async countByCampaign(campaignId: number): Promise<number> {
    const result = await getDb()
      .select({ count: count() })
      .from(campaignArtifacts)
      .where(eq(campaignArtifacts.campaignId, campaignId));

    return Number(result[0]?.count ?? 0);
  }
}
