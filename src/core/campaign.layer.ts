import { logger } from './logger.js';
import { WorkerRpcClient } from './worker.rpc.js';
import { $hypervisorLayer } from './hypervisor.layer.js';
import type { CampaignLifecycleInfo, CampaignSnapshot, CampaignWatcherMethod } from './campaign.protocol.js';
import type { IRClientInfo } from './hypervisor.protocol.js';

const CAMPAIGN_WORKER_PATH = `${import.meta.dir}/../workers/campaign.ts`;

export class CampaignLayer extends WorkerRpcClient<CampaignWatcherMethod> {
  private static instance: CampaignLayer;
  private constructor() {
    super(CAMPAIGN_WORKER_PATH);
    this.autoRestart = true;
    this.registerHostHandler('getAccounts', (params: { addresses?: string[] }) => this.getAccounts(params));
  }

  public static getInstance(): CampaignLayer {
    if (!CampaignLayer.instance) {
      logger.info('Creating CampaignLayer instance');
      CampaignLayer.instance = new CampaignLayer();
    }
    return CampaignLayer.instance;
  }

  protected async onWorkerRestarted(): Promise<void> {
    logger.info('Resuming campaign watcher after worker restart');
    await this.start();
  }

  private async getAccounts(params: { addresses?: string[] }): Promise<IRClientInfo[]> {
    const all = await $hypervisorLayer.getAllIRClients();
    const addresses = params?.addresses?.length ? params.addresses : Object.keys(all);

    return addresses
      .map((address) => all[address])
      .filter((info): info is IRClientInfo => Boolean(info));
  }

  public async start(): Promise<boolean> {
    return this.call<boolean>('start');
  }

  public async stop(): Promise<boolean> {
    return this.call<boolean>('stop');
  }

  public async isRunning(): Promise<boolean> {
    return this.call<boolean>('isRunning');
  }

  public async getSnapshot(): Promise<CampaignSnapshot[]> {
    return this.call<CampaignSnapshot[]>('getSnapshot');
  }

  public async getLifecycles(): Promise<CampaignLifecycleInfo[]> {
    return this.call<CampaignLifecycleInfo[]>('getLifecycles');
  }
}

export const $campaignLayer = CampaignLayer.getInstance();
