import { createHash, randomBytes } from 'crypto';
import { logger } from '../core/logger.js';
import { MtClient, type MtAccountInfo } from './mtclient.js';
import { loadMtCredentials, type IMtClientCreation } from './mtcore.js';
import { AccountRepository } from '../models/account.js';
import { ProxyRepository } from '../models/proxy.js';
import { Observable } from 'rxjs';
import mitt from 'mitt';

const NAME_RE = /^[\w.\-]{1,64}$/;

export interface MtTierOptions {
    /** Which tier (shard) this instance owns. */
    tier?: number;
    /** Total number of tiers clients are distributed across. */
    tierCount?: number;
    /** Pre-existing clients (used when reloading a tier). */
    clients?: Map<string, MtClient>;
}

/** Thrown when a client is addressed to a tier handled by another instance. */
export class TierMismatchError extends Error {
    constructor(
        readonly name: string,
        readonly ownerTier: number,
        readonly currentTier: number,
    ) {
        super(`Client "${name}" belongs to tier ${ownerTier}, this orchestration handles tier ${currentTier}`);
        this.name = 'TierMismatchError';
    }
}

export class MtOrchestration {
    protected observableClients: Observable<MtClient>;

    private emitter = mitt<{
        register: MtClient;
        remove: MtClient;
    }>();

    /** Tier this instance owns; clients are distributed across `tierCount` tiers. */
    readonly tier: number;
    readonly tierCount: number;

    private clients: Map<string, MtClient>;
    private pending = new Map<string, Promise<string>>();

    constructor(options: MtTierOptions = {}) {
        const tierCount = Math.max(1, Math.floor(options.tierCount ?? 1));
        const tier = Math.min(Math.max(0, Math.floor(options.tier ?? 0)), tierCount - 1);
        this.tier = tier;
        this.tierCount = tierCount;
        this.clients = options.clients ?? new Map();
        this.observableClients = new Observable((subscriber) => {
            this.emitter.on('register', subscriber.next.bind(subscriber));
            this.emitter.on('remove', subscriber.next.bind(subscriber));
        });
        logger.info(`MtOrchestration initialized on tier ${this.tier}/${this.tierCount}`);
    }

    /** Deterministically map an account name onto a tier. */
    static resolveTier(name: string, tierCount: number): number {
        if (tierCount <= 1) return 0;
        const hash = createHash('sha256').update(name).digest();
        return hash.readUInt32BE(0) % tierCount;
    }

    /** Deterministic 0x address for an account name (shared by DB records). */
    static addressFor(name: string): string {
        return '0x' + createHash('sha256').update(name).digest('hex').slice(0, 40);
    }

    /** Whether this instance is responsible for the given account name. */
    owns(name: string): boolean {
        return MtOrchestration.resolveTier(name, this.tierCount) === this.tier;
    }

    private generateAddress(stringBased?: string): string {
        const hex = stringBased
            ? createHash('sha256').update(stringBased).digest('hex').slice(0, 40) // deterministic
            : randomBytes(20).toString('hex');
        return '0x' + hex;
    }

    /** Register an already connected client. */
    registerClient(client: MtClient, address?: string): string {
        const id = address ?? this.generateAddress(client.getAddress());
        if (this.clients.has(id)) {
            logger.warn(`Client already registered at ${id}`);
            return id;
        }

        this.clients.set(id, client);
        this.emitter.emit('register', client);
        logger.info(`Registered client at address ${id} (tier ${this.tier})`);
        return id;
    }

    unregisterClient(address: string): MtClient | undefined {
        const client = this.clients.get(address);
        if (!client) return undefined;

        this.clients.delete(address);
        this.emitter.emit('remove', client);
        return client;
    }

    async spawnClient(
        name: string,
        tdataPath: string,
        options: Partial<IMtClientCreation> & { proxyId?: number; persist?: boolean } = {},
    ): Promise<string> {
        if (!NAME_RE.test(name)) throw new Error(`Invalid client name: ${name}`);

        const ownerTier = MtOrchestration.resolveTier(name, this.tierCount);
        if (ownerTier !== this.tier) {
            // A worker handling another tier must serve this client instead
            throw new TierMismatchError(name, ownerTier, this.tier);
        }

        const address = this.generateAddress(name);
        if (this.clients.has(address)) {
            logger.warn(`Client ${name} already spawned at ${address}`);
            return address;
        }

        // Concurrent spawn of same name: share one in-flight promise.
        const inflight = this.pending.get(address);
        if (inflight) return inflight;

        const persist = options.persist !== false;
        const proxyId = options.proxyId != null ? options.proxyId : undefined;

        const task = (async () => {
            // Credentials from env; user options can't override them with undefined.
            const cleanOptions = Object.fromEntries(
                Object.entries(options).filter(([, v]) => v !== undefined)
            ) as Record<string, unknown>;
            delete cleanOptions.proxyId;
            delete cleanOptions.persist;

            const opts = { ...loadMtCredentials(), ...cleanOptions, accountName: name } as IMtClientCreation;

            if (proxyId !== undefined) {
                if (!Number.isInteger(proxyId) || proxyId <= 0) {
                    throw new Error(`Invalid proxyId: ${String(proxyId)}`);
                }
                const proxy = await new ProxyRepository().getProxyById(proxyId);
                if (!proxy) {
                    throw new Error(`Proxy ${proxyId} not found`);
                }
                opts.proxy = ProxyRepository.forClient(proxy);
                logger.info(`Client ${name} routed via proxy ${proxy.name} (${proxy.type})`);
            }

            const client = new MtClient(address, opts);
            if (!tdataPath && !(await client.hasExistingSession())) {
                throw new Error('Invalid tdata path: account has no stored session');
            }
            await client.connect(tdataPath || undefined);

            this.registerClient(client, address);
            logger.info(`Spawned client ${name} at address ${address} (tier ${this.tier}/${this.tierCount})`);

            if (persist) {
                try {
                    await new AccountRepository().registerAccount(name, address, tdataPath || null, proxyId ?? null);
                } catch (e) {
                    logger.error({ err: e, name }, 'Failed to persist account');
                }
            }

            return address;
        })().finally(() => this.pending.delete(address));

        this.pending.set(address, task);
        return task;
    }

    getClient(address: string): MtClient | undefined {
        return this.clients.get(address);
    }

    /** Read-only copy so callers can't mutate internal state. */
    getAllClients(): ReadonlyMap<string, MtClient> {
        return new Map(this.clients);
    }

    getAllAddresses(): string[] {
        return Array.from(this.clients.keys());
    }

    async removeClient(address: string): Promise<boolean> {
        const client = this.unregisterClient(address);
        if (!client) return false;

        await client.disconnect();
        return true;
    }

    /** Serializable descriptions for bot/UI consumers. */
    describeAll(): Record<string, MtAccountInfo> {
        const result: Record<string, MtAccountInfo> = {};
        for (const [address, client] of this.clients) {
            result[address] = client.describe();
        }
        return result;
    }

    describeClient(address: string): MtAccountInfo | null {
        return this.clients.get(address)?.describe() ?? null;
    }

    /** Spawn every enabled account stored in the database (tier-owned only). */
    async autoload(): Promise<string[]> {
        logger.info(`Autoloading enabled accounts from database (tier ${this.tier}/${this.tierCount})`);

        const accounts = await new AccountRepository().getEnabledAccounts();
        const addresses: string[] = [];

        for (const account of accounts) {
            if (this.clients.has(account.address)) continue;

            if (!this.owns(account.name)) {
                logger.info(`Skipping ${account.name}: tier ${MtOrchestration.resolveTier(account.name, this.tierCount)}`);
                continue;
            }

            try {
                addresses.push(await this.spawnClient(
                    account.name,
                    account.tdataPath ?? '',
                    { proxyId: account.proxyId ?? undefined },
                ));
            } catch (e) {
                logger.error(`Failed to autoload account ${account.name}: ${e instanceof Error ? e.message : String(e)}`);
            }
        }

        logger.info(`Autoloaded ${addresses.length} accounts`);
        return addresses;
    }
}

function envTier(): { tier: number; tierCount: number } {
    const tierCount = Math.max(1, Number.parseInt(process.env.MT_TIER_COUNT ?? '', 10) || 1);
    const tier = Number.parseInt(process.env.MT_TIER ?? '', 10) || 0;
    return { tier: Math.min(tier, tierCount - 1), tierCount };
}

/** Default instance; a worker owns exactly one tier via MT_TIER/MT_TIER_COUNT. */
export const $mtOrchestration = new MtOrchestration(envTier());
