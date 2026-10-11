import { existsSync } from 'fs';
import { logger } from './logger.js';
import { SQLiteDatabase } from './database.js';
import { AdCampaignRepository } from '../models/ad-campaign.js';
import type { AdCampaign } from '../models/ad-campaign.js';
import type { CampaignSnapshot } from './campaign.protocol.js';

const DEFAULT_DATABASE_PATH = './data/app.db';
const DEFAULT_POLL_INTERVAL_MS = 1500;
const POLL_RETRIES = 3;
const POLL_RETRY_DELAY_MS = 50;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type CampaignChange =
  | { kind: 'init'; campaigns: AdCampaign[]; previous: null }
  | { kind: 'created'; campaign: AdCampaign; previous: null }
  | { kind: 'status'; campaign: AdCampaign; previous: AdCampaign }
  | { kind: 'updated'; campaign: AdCampaign; previous: AdCampaign }
  | { kind: 'deleted'; campaign: AdCampaign; previous: AdCampaign };

export type CampaignChangeListener = (change: CampaignChange) => void;

/**
 * Watches the `ad_campaigns` table and reports any change
 * (creation, status transitions, updates, deletions) to the terminal.
 *
 * Runs inside the campaign worker and owns its own read-only
 * database connection, so it never interferes with main-thread writes.
 */
export class CampaignWatcher {
  private repo: AdCampaignRepository | null = null;
  private known: Map<number, AdCampaign> = new Map();
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private seeded = false;
  private waitingLogged = false;
  private changeListener: CampaignChangeListener | null = null;

  constructor(
    private readonly databasePath: string = DEFAULT_DATABASE_PATH,
    private readonly pollIntervalMs: number = DEFAULT_POLL_INTERVAL_MS,
  ) {}

  public get dbPath(): string {
    return this.databasePath;
  }

  public isRunning(): boolean {
    return this.running;
  }

  public setChangeListener(listener: CampaignChangeListener): void {
    this.changeListener = listener;
  }

  public start(): void {
    if (this.running) return;
    this.running = true;

    logger.info(
      { dbPath: this.databasePath, pollIntervalMs: this.pollIntervalMs },
      'Campaign watcher started'
    );

    void this.poll();
    this.timer = setInterval(() => void this.poll(), this.pollIntervalMs);
  }

  public stop(): void {
    if (!this.running) return;
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    logger.info('Campaign watcher stopped');
  }

  public getSnapshot(): CampaignSnapshot[] {
    return Array.from(this.known.values())
      .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
      .map((campaign) => ({
        id: campaign.id!,
        name: campaign.name,
        status: campaign.status,
        updatedAt: campaign.updatedAt ?? null,
      }));
  }

  private ensureRepo(): AdCampaignRepository | null {
    if (this.repo) return this.repo;

    // database may still be initializing on the main thread — retry until it exists
    if (!existsSync(this.databasePath)) {
      this.logWaiting();
      return null;
    }

    try {
      this.repo = new AdCampaignRepository(
        new SQLiteDatabase({ path: this.databasePath, readonly: true })
      );
      logger.info(`Campaign watcher connected to ${this.databasePath}`);
    } catch (error) {
      logger.error({ err: error }, 'Campaign watcher failed to open database');
      return null;
    }

    return this.repo;
  }

  private logWaiting(): void {
    if (this.waitingLogged) return;
    this.waitingLogged = true;
    logger.info(`Campaign watcher waiting for database at ${this.databasePath}`);
  }

  private logWatching(): void {
    if (!this.waitingLogged) return;
    this.waitingLogged = false;
    logger.info('Campaign watcher is watching ad_campaigns');
  }

  private async poll(): Promise<void> {
    if (!this.running) return;

    const repo = this.ensureRepo();
    if (!repo) return;

    let campaigns: AdCampaign[] | undefined;
    for (let attempt = 1; attempt <= POLL_RETRIES; attempt++) {
      try {
        campaigns = await repo.getAllCampaigns();
        break;
      } catch (error) {
        // table is not migrated yet, or the database is briefly locked
        if (attempt === POLL_RETRIES) {
          this.logWaiting();
          return;
        }
        await delay(POLL_RETRY_DELAY_MS);
      }
    }

    if (!campaigns) return;

    this.logWatching();
    this.diff(campaigns);
  }

  private diff(campaigns: AdCampaign[]): void {
    const seen = new Set<number>();

    for (const campaign of campaigns) {
      const id = campaign.id!;
      seen.add(id);

      const previous = this.known.get(id);
      this.known.set(id, campaign);

      if (!previous) {
        if (!this.seeded) continue;
        logger.info(`[campaign] #${id} "${campaign.name}" created (status: ${campaign.status})`);
        this.emit({ kind: 'created', campaign, previous: null });
        continue;
      }

      if (previous.status !== campaign.status) {
        logger.info(
          `[campaign] #${id} "${campaign.name}" status changed: ${previous.status} -> ${campaign.status}`
        );
        this.emit({ kind: 'status', campaign, previous });
      } else if (previous.updatedAt !== campaign.updatedAt) {
        logger.info(`[campaign] #${id} "${campaign.name}" updated`);
        this.emit({ kind: 'updated', campaign, previous });
      }
    }

    for (const [id, previous] of Array.from(this.known)) {
      if (seen.has(id)) continue;
      logger.info(`[campaign] #${id} "${previous.name}" deleted`);
      this.known.delete(id);
      this.emit({ kind: 'deleted', campaign: previous, previous });
    }

    if (!this.seeded) {
      this.seeded = true;
      this.emit({ kind: 'init', campaigns: this.getKnownCampaigns(), previous: null });
      logger.info(
        { total: this.known.size, statuses: this.countByStatus() },
        'Campaign watcher loaded initial campaign state'
      );
    }
  }

  private getKnownCampaigns(): AdCampaign[] {
    return Array.from(this.known.values()).sort((a, b) => (a.id ?? 0) - (b.id ?? 0));
  }

  private countByStatus(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const campaign of this.known.values()) {
      counts[campaign.status] = (counts[campaign.status] ?? 0) + 1;
    }
    return counts;
  }

  private emit(change: CampaignChange): void {
    this.changeListener?.(change);
  }
}
