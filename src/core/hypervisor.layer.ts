import { logger } from './logger.js';
import { WorkerRpcClient } from './worker.rpc.js';
import type { IRClientInfo, HypervisorMethod } from './hypervisor.protocol.js';

const HYPERVISOR_WORKER_PATH = `${import.meta.dir}/../workers/hypervisor.ts`;

export class HypervisorLayer extends WorkerRpcClient<HypervisorMethod> {
  private static instance: HypervisorLayer;
  private constructor() {
    super(HYPERVISOR_WORKER_PATH);
  }

  public static getInstance(): HypervisorLayer {
    if (!HypervisorLayer.instance) {
      logger.info('Creating HypervisorLayer instance');
      HypervisorLayer.instance = new HypervisorLayer();
    }
    return HypervisorLayer.instance;
  }

  public async autoload(configPath?: string): Promise<string[]> {
    return this.call<string[]>('autoload', { configPath });
  }

  public async spawnIRClient(name: string, path: string, options: Record<string, any> = {}): Promise<string> {
    return this.call<string>('spawnIRClient', { name, path, options });
  }

  public async removeIRClient(address: string): Promise<void> {
    await this.call<void>('removeIRClient', { address });
  }

  public async getAllIRCAddresses(): Promise<string[]> {
    return this.call<string[]>('getAllIRCAddresses');
  }

  public async getAllIRClients(): Promise<Record<string, IRClientInfo>> {
    return this.call<Record<string, IRClientInfo>>('getAllIRClients');
  }

  public async getIRClient(address: string): Promise<IRClientInfo | null> {
    return this.call<IRClientInfo | null>('getIRClient', { address });
  }
}

export const $hypervisorLayer = HypervisorLayer.getInstance();
