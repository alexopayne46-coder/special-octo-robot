import { BaseEntity, BaseRepository } from '../core/repository.js';
import { SQLiteDatabase } from '../core/database.js';

export const CAMPAIGN_TYPES = ['SPM::SendToChats', 'Common::common'] as const;
export type CampaignType = (typeof CAMPAIGN_TYPES)[number];

export const CAMPAIGN_STATUSES = ['draft', 'scheduled', 'running', 'completed', 'failed'] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const CAMPAIGN_CREATE_STATUSES = ['draft', 'scheduled'] as const;
export type CampaignCreateStatus = (typeof CAMPAIGN_CREATE_STATUSES)[number];

export interface AdCampaignTime {
  startAt?: string;
  endAt?: string;
  asFastAsPossible: boolean;
}

export interface AdCampaignPayload {
  [key: string]: any;
}

export interface AdCampaign extends BaseEntity {
  name: string;
  time: AdCampaignTime;
  payload: AdCampaignPayload;
  campaignType: CampaignType;
  status: CampaignStatus;
  addressesForCampaign: string[];
}

export type AdCampaignCreate = Omit<AdCampaign, 'id' | 'createdAt' | 'updatedAt'>;
export type AdCampaignUpdate = Partial<AdCampaignCreate>;

export class AdCampaignRepository extends BaseRepository<AdCampaign> {
  constructor(db: SQLiteDatabase) {
    super(db, 'ad_campaigns');
  }

  async getAllCampaigns(limit?: number): Promise<AdCampaign[]> {
    const rows = await this.findAll(limit);
    return rows.map((row) => this.parseRow(row));
  }

  async getCampaignById(id: number): Promise<AdCampaign | null> {
    const sql = `SELECT * FROM ${this.tableName} WHERE id = ?`;
    const row = await this.db.queryOne<any>(sql, [id]);
    return row ? this.parseRow(row) : null;
  }

  async findByStatus(status: CampaignStatus): Promise<AdCampaign[]> {
    const rows = await this.findManyBy({ status } as Partial<AdCampaign>);
    return rows.map((row) => this.parseRow(row));
  }

  async createCampaign(data: AdCampaignCreate): Promise<number> {
    const now = new Date().toISOString();
    const time = JSON.stringify(data.time ?? { asFastAsPossible: true });
    const payload = JSON.stringify(data.payload ?? {});
    const addresses = JSON.stringify(data.addressesForCampaign ?? []);

    const sql = `
      INSERT INTO ${this.tableName}
      (name, time, payload, campaignType, status, addressesForCampaign, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    this.db.execute(sql, [
      data.name,
      time,
      payload,
      data.campaignType,
      data.status,
      addresses,
      now,
      now,
    ]);

    return this.lastInsertId();
  }

  async updateCampaign(id: number, updates: AdCampaignUpdate): Promise<void> {
    if (Object.keys(updates).length === 0) return;

    const now = new Date().toISOString();
    const fields = Object.keys(updates);
    const setClause = fields.map((field) => `${field} = ?`).join(', ');
    const values = fields.map((field) => this.serialize(field, updates[field as keyof AdCampaignUpdate]));

    const sql = `UPDATE ${this.tableName} SET ${setClause}, updatedAt = ? WHERE id = ?`;
    this.db.execute(sql, [...values, now, id]);
  }

  async deleteById(id: number): Promise<void> {
    const sql = `DELETE FROM ${this.tableName} WHERE id = ?`;
    this.db.execute(sql, [id]);
  }

  async deleteAll(): Promise<void> {
    const sql = `DELETE FROM ${this.tableName}`;
    this.db.execute(sql, []);
  }

  async updateStatus(id: number, status: CampaignStatus): Promise<void> {
    await this.updateCampaign(id, { status });
  }

  async countAll(): Promise<number> {
    const sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    const result = await this.db.queryOne<{ count: number }>(sql, []);
    return result?.count ?? 0;
  }

  private async lastInsertId(): Promise<number> {
    const result = await this.db.queryOne<{ rowid: number }>('SELECT last_insert_rowid() AS rowid', [])
    return result?.rowid ?? 0
  }

  private serialize(field: string, value: unknown): any {
    if (field === 'time' || field === 'payload' || field === 'addressesForCampaign') {
      return JSON.stringify(value);
    }
    return value;
  }

  private parseRow(row: any): AdCampaign {
    return {
      ...row,
      time: this.parseJSON(row.time, { asFastAsPossible: true }),
      payload: this.parseJSON(row.payload, {}),
      addressesForCampaign: this.parseJSON(row.addressesForCampaign, []),
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
