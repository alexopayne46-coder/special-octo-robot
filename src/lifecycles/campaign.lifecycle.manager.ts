import { logger } from '../core/logger.js';
import { AdCampaignRepository } from '../models/ad-campaign.js';
import { CampaignArtifactRepository } from '../models/campaign-artifact.js';
import { CAMPAIGN_LIFECYCLES } from './campaign.lifecycle.registry.js';
import type { AccountFetcher, ArtifactSubmit, CampaignLifecycle } from './campaign.lifecycle.js';
import type { AdCampaign, CampaignStatus } from '../models/ad-campaign.js';
import type { CampaignChange } from '../core/campaign.watcher.js';

const DB_WRITE_RETRIES = 3;
const DB_WRITE_RETRY_DELAY_MS = 100;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CampaignLifecycleManager {
  private lifecycles: Map<number, CampaignLifecycle> = new Map();
  private repo: AdCampaignRepository | null = null;
  private artifactRepo: CampaignArtifactRepository | null = null;

  constructor(
    private readonly fetchAccounts: AccountFetcher,
  ) {}

  public handleChange(change: CampaignChange): void {
    switch (change.kind) {
      case 'init':
        for (const campaign of change.campaigns) {
          this.spawn(campaign);
        }
        break;
      case 'created':
        this.spawn(change.campaign);
        break;
      case 'status':
        this.dispatch(change.campaign.id!, (lifecycle) =>
          lifecycle.handleExternalStatusChange(change.campaign)
        );
        break;
      case 'updated':
        this.dispatch(change.campaign.id!, (lifecycle) =>
          lifecycle.handleExternalUpdate(change.campaign)
        );
        break;
      case 'deleted':
        this.dispatch(change.campaign.id!, (lifecycle) => lifecycle.handleDeleted(), true);
        break;
    }
  }

  public getLifecycles(): CampaignLifecycle[] {
    return Array.from(this.lifecycles.values()).sort((a, b) => a.id - b.id);
  }

  public disposeAll(): void {
    for (const lifecycle of this.lifecycles.values()) {
      lifecycle.dispose();
    }
    this.lifecycles.clear();
  }

  private spawn(campaign: AdCampaign): void {
    const id = campaign.id!;

    if (this.lifecycles.has(id)) return;

    const LifecycleClass = CAMPAIGN_LIFECYCLES[campaign.campaignType];
    if (!LifecycleClass) {
      logger.warn(`[lifecycle] no lifecycle registered for campaign type "${campaign.campaignType}"`);
      return;
    }

    const lifecycle = new LifecycleClass(
      { ...campaign },
      {
        persistStatus: (status) => this.persistStatus(id, status),
        fetchAccounts: this.fetchAccounts,
        createArtifact: (artifact: ArtifactSubmit) => this.createArtifact(id, artifact),
      }
    );
    this.lifecycles.set(id, lifecycle);

    void lifecycle.handleCreated().catch((error) =>
      logger.error({ err: error }, `[lifecycle] #${id} created hook failed`)
    );

    void lifecycle.resume().catch((error) =>
      logger.error({ err: error }, `[lifecycle] #${id} resume failed`)
    );
  }

  private dispatch(
    id: number,
    action: (lifecycle: CampaignLifecycle) => Promise<void>,
    remove = false,
  ): void {
    const lifecycle = this.lifecycles.get(id);
    if (!lifecycle) {
      logger.warn(`[lifecycle] #${id} has no lifecycle to handle change`);
      return;
    }

    void action(lifecycle)
      .catch((error) => logger.error({ err: error }, `[lifecycle] #${id} change handling failed`))
      .finally(() => {
        if (remove) {
          this.lifecycles.delete(id);
        }
      });
  }

  private async persistStatus(id: number, status: CampaignStatus): Promise<void> {
    await this.withRetry(async () => {
      const repo = this.ensureRepo();
      if (!repo) {
        throw new Error('Campaign lifecycle manager has no database connection');
      }

      await repo.updateStatus(id, status);
    }, `persist status "${status}" for campaign #${id}`);
  }

  private async createArtifact(id: number, artifact: ArtifactSubmit): Promise<void> {
    await this.withRetry(async () => {
      const repo = this.ensureArtifactRepo();
      if (!repo) {
        throw new Error('Campaign lifecycle manager has no artifacts database connection');
      }

      await repo.createArtifact({
        campaignId: id,
        text: artifact.text,
        mood: artifact.mood,
        payload: artifact.payload ?? {},
      });
    }, `create artifact for campaign #${id}`);
  }

  private async withRetry(operation: () => Promise<void>, label: string): Promise<void> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= DB_WRITE_RETRIES; attempt++) {
      try {
        await operation();
        return;
      } catch (error) {
        lastError = error;

        if (attempt < DB_WRITE_RETRIES) {
          logger.warn(
            { err: error instanceof Error ? error : new Error(String(error)) },
            `Failed to ${label}, retrying (${attempt}/${DB_WRITE_RETRIES})`
          );
          await delay(DB_WRITE_RETRY_DELAY_MS * attempt);
        }
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }

  private ensureRepo(): AdCampaignRepository {
    if (this.repo) return this.repo;

    this.repo = new AdCampaignRepository();
    logger.info('Campaign lifecycle manager connected to ad_campaigns');

    return this.repo;
  }

  private ensureArtifactRepo(): CampaignArtifactRepository {
    if (this.artifactRepo) return this.artifactRepo;

    this.artifactRepo = new CampaignArtifactRepository();
    logger.info('Campaign lifecycle manager connected to campaign_artifacts');

    return this.artifactRepo;
  }
}
