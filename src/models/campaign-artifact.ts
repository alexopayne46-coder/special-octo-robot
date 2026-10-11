import { BaseEntity, BaseRepository } from '../core/repository.js';
import { SQLiteDatabase } from '../core/database.js';

export const ARTIFACT_MOODS = ['positive', 'negative', 'neutral'] as const;
export type ArtifactMood = (typeof ARTIFACT_MOODS)[number];

export interface CampaignArtifact extends BaseEntity {
  campaignId: number;
  text: string;
  mood: ArtifactMood;
  payload: Record<string, any>;
}

export type CampaignArtifactCreate = Omit<CampaignArtifact, 'id' | 'createdAt' | 'updatedAt'>;

export type CampaignArtifactUpdate = Partial<CampaignArtifactCreate>;

export class CampaignArtifactRepository extends BaseRepository<CampaignArtifact> {
  constructor(db: SQLiteDatabase) {
    super(db, 'campaign_artifacts');
  }

  async getByCampaign(campaignId: number, limit?: number): Promise<CampaignArtifact[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM ${this.tableName} WHERE campaignId = ? ORDER BY id ASC LIMIT ?`,
      [campaignId, limit ?? Number.MAX_SAFE_INTEGER]
    );
    return rows.map((row) => this.parseRow(row));
  }

  async getById(id: number): Promise<CampaignArtifact | null> {
    const row = await this.db.queryOne<any>(`SELECT * FROM ${this.tableName} WHERE id = ?`, [id]);
    return row ? this.parseRow(row) : null;
  }

  async createArtifact(data: CampaignArtifactCreate): Promise<number> {
    const now = new Date().toISOString();

    const sql = `
      INSERT INTO ${this.tableName}
      (campaignId, text, mood, payload, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    this.db.execute(sql, [
      data.campaignId,
      data.text,
      data.mood ?? 'neutral',
      JSON.stringify(data.payload ?? {}),
      now,
      now,
    ]);

    return this.lastInsertId();
  }

  async updateArtifact(id: number, updates: CampaignArtifactUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const now = new Date().toISOString();
    const fields = Object.keys(updates);
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => this.serialize(field, updates[field as keyof CampaignArtifactUpdate]));

    const sql = `UPDATE ${this.tableName} SET ${setClause}, updatedAt = ? WHERE id = ?`;
    this.db.execute(sql, [...values, now, id]);
  }

  async deleteByCampaign(campaignId: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE campaignId = ?`;
    this.db.execute(sql, [campaignId]);
  }

  async deleteById(id: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    this.db.execute(sql, [id]);
  }

  async countByCampaign(campaignId: number): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName} WHERE campaignId = ?`;
    const result = await this.db.queryOne<{ count: number }>(sql, [campaignId]);
    return result?.count ?? 0;
  }

  private async lastInsertId(): Promise<number> {
    const result = await this.db.queryOne<{ rowid: number }>('SELECT last_insert_rowid() AS rowid', []);
    return result?.rowid ?? 0;
  }

  private serialize(field: string, value: unknown): any {
    if (field === 'payload') {
      return JSON.stringify(value);
    }
    return value;
  }

  private parseRow(row: any): CampaignArtifact {
    return {
      ...row,
      payload: this.parseJSON(row.payload, {}),
    };
  }

  private parseJSON(value: string | null | undefined, fallback: any): any {
    if (!value) return fallback;
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
}
