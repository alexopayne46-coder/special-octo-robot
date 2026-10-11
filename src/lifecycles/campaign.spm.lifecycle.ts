import { CampaignLifecycle } from './campaign.lifecycle.js';
import { logger } from '../core/logger.js';
import type { AdCampaign, CampaignStatus } from '../models/ad-campaign.js';
import type { CampaignLifecycleContext } from './campaign.lifecycle.js';

const MINUTE_MS = 60_000;

export class CampaignSPMLifecycle extends CampaignLifecycle {
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(campaign: AdCampaign, context: CampaignLifecycleContext) {
    super(campaign, context);
  }

  protected async onResume(): Promise<void> {
    if (this.status === 'running') {
      await this.execute();
      return;
    }

    if (this.status === 'scheduled') {
      this.scheduleStart();
    }
  }

  protected async onStatusChanged(previous: CampaignStatus, next: CampaignStatus): Promise<void> {
    this.clearTimer();

    switch (next) {
      case 'draft':
        logger.info(`[SPM] #${this.id} "${this.name}" returned to draft`);
        break;
      case 'scheduled':
        this.scheduleStart();
        break;
      case 'running':
        await this.execute();
        break;
      case 'completed':
        logger.info(`[SPM] #${this.id} "${this.name}" finished`);
        break;
      case 'failed':
        logger.warn(`[SPM] #${this.id} "${this.name}" failed`);
        break;
    }
  }

  public async execute(): Promise<void> {
    const messageText = this.readMessageText();

    if (!messageText) {
      logger.error(`[SPM] #${this.id} "${this.name}" has no message text in payload`);
      await this.safeSetStatus('failed');
      return;
    }

    if (this.addresses.length === 0) {
      logger.error(`[SPM] #${this.id} "${this.name}" has no addressesForCampaign`);
      await this.safeSetStatus('failed');
      return;
    }

    logger.info(
      `[SPM] #${this.id} "${this.name}" delivering ${messageText.length} chars to group ` +
      `${this.groupId ?? 'none'} via ${this.addresses.length} address(es)`
    );

    await this.deliver(messageText);

    logger.info(`[SPM] #${this.id} "${this.name}" delivery step done`);
    await this.safeSetStatus('completed');
  }

  private get addresses(): string[] {
    return Array.isArray(this.campaign.addressesForCampaign)
      ? this.campaign.addressesForCampaign
      : [];
  }

  private get groupId(): number | null {
    const value = this.campaign.payload?.groupId;
    return typeof value === 'number' ? value : null;
  }

  private readMessageText(): string {
    const value = this.campaign.payload?.messageText;
    return typeof value === 'string' ? value.trim() : '';
  }

  private async deliver(messageText: string): Promise<void> {
    logger.info(
      `[SPM] #${this.id} "${this.name}" send execution pending hypervisor integration ` +
      `(${messageText.length} chars, ${this.addresses.length} address(es))`
    );
  }

  private scheduleStart(): void {
    this.clearTimer();

    const startAt = this.campaign.time?.startAt ? new Date(this.campaign.time.startAt) : null;
    if (!startAt) {
      logger.warn(`[SPM] #${this.id} "${this.name}" is scheduled without time.startAt`);
      return;
    }

    const delay = startAt.getTime() - Date.now();
    if (delay <= 0) {
      logger.info(`[SPM] #${this.id} "${this.name}" start time has passed, starting now`);
      this.startRunning();
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.startRunning();
    }, delay);

    logger.info(
      `[SPM] #${this.id} "${this.name}" scheduled to start at ${startAt.toISOString()} ` +
      `(in ${Math.round(delay / MINUTE_MS)} min)`
    );
  }

  private startRunning(): void {
    void this.setStatus('running').catch((error) =>
      logger.error({ err: error }, `[SPM] #${this.id} failed to transition to running`)
    );
  }

  private clearTimer(): void {
    if (!this.timer) return;
    clearTimeout(this.timer);
    this.timer = null;
  }

  protected onDispose(): void {
    this.clearTimer();
  }
}
