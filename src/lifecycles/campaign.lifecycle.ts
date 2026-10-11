import { logger } from '../core/logger.js';
import type { AdCampaign, CampaignStatus } from '../models/ad-campaign.js';
import type { ArtifactMood } from '../models/campaign-artifact.js';
import type { IRClientInfo } from '../core/hypervisor.protocol.js';

export type StatusPersister = (status: CampaignStatus) => Promise<void>;

export type AccountFetcher = (addresses: string[]) => Promise<IRClientInfo[]>;

export interface ArtifactSubmit {
  text: string;
  mood: ArtifactMood;
  payload?: Record<string, any>;
}

export type ArtifactCreator = (artifact: ArtifactSubmit) => Promise<void>;

export interface CampaignLifecycleContext {
  persistStatus: StatusPersister;
  fetchAccounts: AccountFetcher;
  createArtifact: ArtifactCreator;
}

export abstract class CampaignLifecycle {
  protected campaign: AdCampaign;
  private selfStatus: CampaignStatus | null = null;
  private disposed = false;

  protected constructor(
    campaign: AdCampaign,
    protected readonly context: CampaignLifecycleContext,
  ) {
    this.campaign = campaign;
  }

  public get id(): number {
    return this.campaign.id!;
  }

  public get name(): string {
    return this.campaign.name;
  }

  public get campaignType(): string {
    return this.campaign.campaignType;
  }

  public get status(): CampaignStatus {
    return this.campaign.status;
  }

  public get isDisposed(): boolean {
    return this.disposed;
  }

  public describe() {
    return {
      id: this.id,
      name: this.name,
      campaignType: this.campaignType,
      status: this.status,
      disposed: this.disposed,
    };
  }

  public async setStatus(status: CampaignStatus): Promise<void> {
    if (this.disposed) {
      logger.warn(`[lifecycle] #${this.id} is disposed, cannot set status "${status}"`);
      return;
    }

    if (this.campaign.status === status) return;

    const previous = this.campaign.status;
    this.selfStatus = status;

    try {
      await this.context.persistStatus(status);
    } catch (error) {
      this.selfStatus = null;
      throw error;
    }

    this.campaign = { ...this.campaign, status };
    logger.info(`[lifecycle] #${this.id} "${this.name}" status: ${previous} -> ${status}`);

    await this.onStatusChanged(previous, status);
  }

  protected async safeSetStatus(status: CampaignStatus): Promise<void> {
    try {
      await this.setStatus(status);
    } catch (error) {
      logger.error(
        { err: error },
        `[lifecycle] #${this.id} failed to persist status "${status}"`
      );
    }
  }

  public async handleCreated(): Promise<void> {
    logger.info(
      `[lifecycle] #${this.id} "${this.name}" (${this.campaignType}) spawned with status "${this.status}"`
    );
    await this.onCreated();
  }

  public async resume(): Promise<void> {
    if (this.disposed) return;
    logger.info(`[lifecycle] #${this.id} "${this.name}" resumed with status "${this.status}"`);
    await this.onResume();
  }

  public async handleExternalStatusChange(next: AdCampaign): Promise<void> {
    const previous = this.campaign.status;
    this.campaign = next;

    if (previous === next.status) return;

    if (this.selfStatus === next.status) {
      this.selfStatus = null;
      logger.debug(`[lifecycle] #${this.id} own status change confirmed: ${previous} -> ${next.status}`);
      return;
    }

    this.selfStatus = null;
    logger.info(
      `[lifecycle] #${this.id} "${next.name}" status changed: ${previous} -> ${next.status}`
    );

    await this.onStatusChanged(previous, next.status);
  }

  public async handleExternalUpdate(next: AdCampaign): Promise<void> {
    this.campaign = next;
    await this.onUpdated(next);
  }

  public async handleDeleted(): Promise<void> {
    await this.onDeleted();
    this.dispose();
  }

  public dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.onDispose();
  }

  public abstract execute(): Promise<void>;

  protected async onCreated(): Promise<void> { }
  protected async onResume(): Promise<void> { }
  protected async onStatusChanged(previous: CampaignStatus, next: CampaignStatus): Promise<void> { }
  protected async onUpdated(next: AdCampaign): Promise<void> { }
  protected async onDeleted(): Promise<void> { }
  protected onDispose(): void { }
}
