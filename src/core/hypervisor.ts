import { ITelegram } from "./isolated.telegram";
import onceImportTelegramClient = ITelegram.onceImportTelegramClient;
import IRClient = ITelegram.IRClient;
import { logger } from "./logger";
import { createHash, randomBytes } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

export class Hypervisor {
  private static instance: Hypervisor;
  private constructor() { }

  private ircmap: Map<string, IRClient> = new Map()


  private generateAddress(stringBased?: string): string {
    const hex = stringBased
      ? createHash('sha256').update(stringBased).digest('hex').slice(0, 40) // deterministic
      : randomBytes(20).toString('hex');                                    // random
    return '0x' + hex;
  }

  public static getInstance(): Hypervisor {
    if (!Hypervisor.instance) {
      logger.info('Creating Hypervisor instance');
      Hypervisor.instance = new Hypervisor();
    }
    return Hypervisor.instance;
  }

  public async spawnIRClient(name: string, path: string, options: {}): Promise<string> {
    const opt = Object.assign({
      apiId: 2040,
      apiHash: "b18441a1ff607e10a989891a5462e627"
    }, options);
    const irclient = await onceImportTelegramClient(name, path, opt)
    const address = this.generateAddress(name)
    this.ircmap.set(address, irclient)
    logger.info(`Spawned IRClient at address ${address}`)
    return address
  }

  public getIRClient(address: string): IRClient | undefined {
    return this.ircmap.get(address)
  }

  public getAllIRClients(): Map<string, IRClient> {
    return this.ircmap
  }

  public removeIRClient(address: string) {
    this.ircmap.delete(address)
  }

  public getAllIRCAddresses(): string[] {
    return Array.from(this.ircmap.keys())
  }

  public async autoload(configPath?: string): Promise<string[]> {
    const path = configPath || join(process.cwd(), 'autoloader.json');
    logger.info(`Loading accounts from ${path}`);

    try {
      const raw = readFileSync(path, 'utf-8');
      const config = JSON.parse(raw);

      if (!config.hypervisor || !config.hypervisor.prefetch) {
        logger.warn('No prefetch accounts found in config');
        return [];
      }

      const accounts = config.hypervisor.prefetch;
      const addresses: string[] = [];

      for (const account of accounts) {
        const { name, tdata, options } = account;
        logger.info(`Autoloading account: ${name}`);

        try {
          const address = await this.spawnIRClient(name, tdata, options || {});
          addresses.push(address);
        } catch (error) {
          logger.error(`Failed to load account ${name}: ${error}`);
        }
      }

      logger.info(`Autoloaded ${addresses.length} accounts`);
      return addresses;
    } catch (error) {
      logger.error(`Failed to read autoload config: ${error}`);
      return [];
    }
  }
}


export const $hypervisor = Hypervisor.getInstance();