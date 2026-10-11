import { CampaignLifecycle } from './campaign.lifecycle.js';
import { CommonCampaignExecutor } from '../executors/common.campaign.executor.js';
import { logger } from '../core/logger.js';
import type { AdCampaign, CampaignStatus } from '../models/ad-campaign.js';
import type { ArtifactMood } from '../models/campaign-artifact.js';
import type { CampaignLifecycleContext } from './campaign.lifecycle.js';

export class CommonCampaignLifecycle extends CampaignLifecycle {
  private executor: CommonCampaignExecutor | null = null;

  constructor(campaign: AdCampaign, context: CampaignLifecycleContext) {
    super(campaign, context);
  }

  protected async onStatusChanged(previous: CampaignStatus, next: CampaignStatus): Promise<void> {
    if (next === 'running') {
      await this.execute();
      return;
    }

    if (previous === 'running' && next === 'draft') {
      await this.destroyExecutor();
    }
  }

  protected async onResume(): Promise<void> {
    if (this.status === 'running') {
      await this.execute();
    }
  }

  public async execute(): Promise<void> {
    const executor = new CommonCampaignExecutor((artifact) =>
      this.context.createArtifact(artifact)
    );
    this.executor = executor;

    logger.info(`[Common::common] #${this.id} "${this.name}" started`);

    try {
      const accounts = await this.context.fetchAccounts(this.campaign.addressesForCampaign);
      await executor.onSpawn(accounts, this.campaign.payload);

      if (executor.isStopped) {
        logger.info(`[Common::common] #${this.id} "${this.name}" stopped before completion`);
        return;
      }

      await this.safeSetStatus('completed');
    } catch (error) {
      logger.error({ err: error }, `[Common::common] #${this.id} "${this.name}" execution failed`);
      await this.logArtifact(`Execution failed`, 'negative', {
        error: error instanceof Error ? error.message : String(error),
      });
      await this.safeSetStatus('failed');
    } finally {
      await this.destroyExecutor();
    }
  }

  private async logArtifact(text: string, mood: ArtifactMood, payload: Record<string, any>): Promise<void> {
    try {
      await this.context.createArtifact({ text, mood, payload });
    } catch (error) {
      logger.error({ err: error }, `[Common::common] #${this.id} failed to write artifact`);
    }
  }

  private async destroyExecutor(): Promise<void> {
    const executor = this.executor;
    if (!executor) return;

    this.executor = null;
    executor.stop();
    await executor.onDestroy();
  }

  protected onDispose(): void {
    this.executor?.stop();
  }
}
