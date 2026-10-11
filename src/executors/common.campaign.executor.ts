import { CampaignExecutor } from './campaign.executor.js';
import { logger } from '../core/logger.js';
import type { IRClientInfo } from '../core/hypervisor.protocol.js';
import type { ArtifactSubmit } from '../lifecycles/campaign.lifecycle.js';

const DEFAULT_STEPS = 5;
const DEFAULT_INTERVAL_MS = 500;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class CommonCampaignExecutor extends CampaignExecutor {
  private steps: number = DEFAULT_STEPS;
  private intervalMs: number = DEFAULT_INTERVAL_MS;

  constructor(
    private readonly submitArtifact?: (artifact: ArtifactSubmit) => Promise<void>,
  ) {
    super();
  }

  public async onSpawn(accounts: IRClientInfo[], opts: Record<string, any>): Promise<void> {
    if (accounts.length === 0) {
      throw new Error('no accounts available from hypervisor');
    }

    this.steps = Number(opts?.steps ?? DEFAULT_STEPS);
    this.intervalMs = Number(opts?.intervalMs ?? DEFAULT_INTERVAL_MS);

    logger.info(
      `[executor:Common::common] spawned with ${accounts.length} account(s), ` +
      `${this.steps} step(s) every ${this.intervalMs}ms`
    );

    for (let step = 1; step <= this.steps; step++) {
      if (this.isStopped || this.isDestroyed) {
        logger.info(`[executor:Common::common] stopped at step ${step}/${this.steps}`);
        return;
      }

      const account = accounts[(step - 1) % accounts.length];
      logger.info(
        `[executor:Common::common] step ${step}/${this.steps} via ` +
        `${account.address} (${account.me?.displayName ?? 'unknown'})`
      );

      await this.logArtifact({
        text: `Step ${step}/${this.steps} executed`,
        mood: 'neutral',
        payload: {
          step,
          steps: this.steps,
          address: account.address,
          account: account.me?.displayName ?? null,
        },
      });

      await delay(this.intervalMs);
    }

    await this.logArtifact({
      text: `Finished ${this.steps} step(s)`,
      mood: 'positive',
      payload: { steps: this.steps, accounts: accounts.length },
    });

    logger.info(`[executor:Common::common] finished ${this.steps} step(s)`);
  }

  public async onDestroy(): Promise<void> {
    if (this.isDestroyed) return;

    this.stop();
    this.markDestroyed();
    logger.info('[executor:Common::common] destroyed');
  }

  private async logArtifact(artifact: ArtifactSubmit): Promise<void> {
    if (!this.submitArtifact) return;

    try {
      await this.submitArtifact(artifact);
    } catch (error) {
      logger.error({ err: error }, '[executor:Common::common] failed to write artifact');
    }
  }
}
