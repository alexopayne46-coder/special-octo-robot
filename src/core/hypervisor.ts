import { ITelegram } from "./isolated.telegram";
import onceImportTelegramClient = ITelegram.onceImportTelegramClient;
import IRClient = ITelegram.IRClient;
import { logger } from "./logger";
import { createHash, randomBytes } from "crypto";
import { promises as fs } from "fs";
import { dirname, resolve } from "path";

const DEFAULT_CONFIG_PATH = "./data/autoloader.json";
const MAX_CONFIG_BYTES = 1024 * 1024; // 1 MB
const MAX_ACCOUNTS = 100;
const NAME_RE = /^[\w.\-]{1,64}$/;

const DEFAULT_CONFIG = { hypervisor: { prefetch: [] as AutoloadAccount[] } };

interface AutoloadAccount {
  name: string;
  tdata: string;
  options?: Record<string, unknown>;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function isAccount(v: unknown): v is AutoloadAccount {
  if (!isPlainObject(v)) return false;
  if (typeof v.name !== "string" || !NAME_RE.test(v.name)) return false;
  if (typeof v.tdata !== "string" || v.tdata.length === 0) return false;
  if (v.options !== undefined && !isPlainObject(v.options)) return false;
  return true;
}

function loadCredentials(): { apiId: number; apiHash: string } {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
    throw new Error("TG_API_ID and TG_API_HASH environment variables must be set");
  }
  return { apiId, apiHash };
}

export class Hypervisor {
  private static instance: Hypervisor | undefined;
  private constructor() {}

  private readonly ircmap = new Map<string, IRClient>();
  private readonly pending = new Map<string, Promise<string>>();

  public static getInstance(): Hypervisor {
    if (!Hypervisor.instance) {
      logger.info("Creating Hypervisor instance");
      Hypervisor.instance = new Hypervisor();
    }
    return Hypervisor.instance;
  }

  private generateAddress(stringBased?: string): string {
    const hex = stringBased
      ? createHash("sha256").update(stringBased).digest("hex").slice(0, 40) // deterministic
      : randomBytes(20).toString("hex"); // random
    return "0x" + hex;
  }

  public async spawnIRClient(
    name: string,
    path: string,
    options: Record<string, unknown> = {}
  ): Promise<string> {
    if (!NAME_RE.test(name)) throw new Error(`Invalid client name: ${name}`);
    if (typeof path !== "string" || !path) throw new Error("Invalid tdata path");

    const address = this.generateAddress(name);

    // Already running: don't overwrite (would leak the old client).
    if (this.ircmap.has(address)) {
      logger.warn(`IRClient ${name} already spawned at ${address}`);
      return address;
    }

    // Concurrent spawn of same name: share one in-flight promise.
    const inflight = this.pending.get(address);
    if (inflight) return inflight;

    const task = (async () => {
      // Credentials from env; user options can't override them with undefined.
      const cleanOptions = Object.fromEntries(
        Object.entries(options).filter(([, v]) => v !== undefined)
      );
      const opt = { ...loadCredentials(), ...cleanOptions };

      const irclient = await onceImportTelegramClient(name, path, opt);
      this.ircmap.set(address, irclient);
      logger.info(`Spawned IRClient at address ${address}`);
      return address;
    })().finally(() => this.pending.delete(address));

    this.pending.set(address, task);
    return task;
  }

  public getIRClient(address: string): IRClient | undefined {
    return this.ircmap.get(address);
  }

  /** Read-only copy so callers can't mutate internal state. */
  public getAllIRClients(): ReadonlyMap<string, IRClient> {
    return new Map(this.ircmap);
  }

  public async removeIRClient(address: string): Promise<boolean> {
    const client = this.ircmap.get(address);
    if (!client) return false;
    this.ircmap.delete(address);

    // Best-effort disconnect; adjust to whatever IRClient actually exposes.
    const c = client as unknown as {
      disconnect?: () => Promise<void> | void;
      destroy?: () => Promise<void> | void;
    };
    try {
      await (c.disconnect?.() ?? c.destroy?.());
    } catch (e) {
      logger.warn(`Error while disconnecting ${address}: ${errMsg(e)}`);
    }
    return true;
  }

  public getAllIRCAddresses(): string[] {
    return Array.from(this.ircmap.keys());
  }

  /** Creates the config file with defaults if it doesn't exist. */
  private async ensureConfigFile(path: string): Promise<void> {
    try {
      await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
      // 'wx' = fail if exists -> atomic, no race, never overwrites.
      await fs.writeFile(path, JSON.stringify(DEFAULT_CONFIG, null, 2) + "\n", {
        flag: "wx",
        mode: 0o600,
      });
      logger.info(`Created default config at ${path}`);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "EEXIST") throw e;
    }
  }

  private async readConfig(path: string): Promise<unknown> {
    await this.ensureConfigFile(path);

    const stat = await fs.stat(path);
    if (!stat.isFile()) throw new Error(`${path} is not a regular file`);
    if (stat.size > MAX_CONFIG_BYTES) {
      throw new Error(`Config too large (${stat.size} bytes)`);
    }

    const raw = await fs.readFile(path, "utf-8");
    return JSON.parse(raw);
  }

  public async autoload(configPath?: string): Promise<string[]> {
    const path = resolve(configPath || DEFAULT_CONFIG_PATH);
    logger.info(`Loading accounts from ${path}`);

    let config: unknown;
    try {
      config = await this.readConfig(path);
    } catch (e) {
      logger.error(`Failed to read autoload config: ${errMsg(e)}`);
      return [];
    }

    const prefetch =
      isPlainObject(config) &&
      isPlainObject(config.hypervisor) &&
      Array.isArray(config.hypervisor.prefetch)
        ? (config.hypervisor.prefetch as unknown[])
        : null;

    if (!prefetch || prefetch.length === 0) {
      logger.warn("No prefetch accounts found in config");
      return [];
    }

    if (prefetch.length > MAX_ACCOUNTS) {
      logger.warn(`Too many accounts, only first ${MAX_ACCOUNTS} will be loaded`);
    }

    const addresses: string[] = [];
    for (const entry of prefetch.slice(0, MAX_ACCOUNTS)) {
      if (!isAccount(entry)) {
        logger.warn("Skipping invalid account entry in config");
        continue;
      }
      const { name, tdata, options } = entry;
      logger.info(`Autoloading account: ${name}`);
      try {
        addresses.push(await this.spawnIRClient(name, tdata, options ?? {}));
      } catch (e) {
        logger.error(`Failed to load account ${name}: ${errMsg(e)}`);
      }
    }

    logger.info(`Autoloaded ${addresses.length} accounts`);
    return addresses;
  }
}

export const $hypervisor = Hypervisor.getInstance();