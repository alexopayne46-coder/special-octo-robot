import type { MtAccountInfo } from '../application/mtclient.js';

export abstract class CampaignExecutor {
  private stopped = false;
  private destroyed = false;

  public abstract onSpawn(accounts: MtAccountInfo[], opts: Record<string, any>): Promise<void>;

  public abstract onDestroy(): Promise<void>;

  public stop(): void {
    if (this.stopped) return;
    this.stopped = true;
  }

  public get isStopped(): boolean {
    return this.stopped;
  }

  public get isDestroyed(): boolean {
    return this.destroyed;
  }

  protected markDestroyed(): void {
    this.destroyed = true;
  }
}
