import { HttpProxySettings, HttpProxyTcpTransport, SqliteStorage, TcpTransport, TelegramClient, User } from '@mtcute/bun';
import { convertFromTdata } from '@mtcute/convert';
import { promises as fs } from 'fs';

export interface IMtClientCreation {
    accountName: string;
    apiId: number;
    apiHash: string;
    proxy?: HttpProxySettings;
    path?: string;
}

const DEFAULT_STORAGE_ROOT = './data';
const NAME_RE = /^[\w.\-]{1,64}$/;

export function loadMtCredentials(): { apiId: number; apiHash: string } {
    const apiId = Number(process.env.TG_API_ID);
    const apiHash = process.env.TG_API_HASH;
    if (!Number.isInteger(apiId) || apiId <= 0 || !apiHash) {
        throw new Error('TG_API_ID and TG_API_HASH environment variables must be set');
    }
    return { apiId, apiHash };
}

export class MtCore {
    protected client: TelegramClient | undefined;
    protected user: User | undefined;
    protected tdataPath: string | undefined;
    protected storage: SqliteStorage | undefined;

    constructor(protected opts: IMtClientCreation) {
        if (!NAME_RE.test(opts.accountName)) {
            throw new Error(`Invalid account name: ${opts.accountName}`);
        }
    }

    /** Session root: data/&lt;accountName&gt; (overridable via opts.path). */
    protected get storagePath(): string {
        return `${this.opts.path ?? DEFAULT_STORAGE_ROOT}/${this.opts.accountName}`;
    }

    /** SqliteStorage opens this exact file, so its folder must exist first. */
    protected get sessionFile(): string {
        return `${this.storagePath}/${this.opts.accountName}`;
    }

    /** Session already imported earlier — reconnect without touching tdata. */
    async hasExistingSession(): Promise<boolean> {
        return fs.exists(this.sessionFile);
    }

    allocate(): this {
        if (!this.storage) {
            this.storage = new SqliteStorage(this.sessionFile);
        }
        this.client = new TelegramClient({
            apiId: this.opts.apiId,
            apiHash: this.opts.apiHash,
            storage: this.storage,
            transport: this.opts.proxy ? new HttpProxyTcpTransport(this.opts.proxy) : new TcpTransport(),
        });

        return this;
    }

    /** Import a tdata folder as the session for this client. */
    async importTdata(tdataPath: string): Promise<this> {
        if (!this.client) throw new Error('Client is not allocated');
        this.tdataPath = tdataPath;

        await this.client.importSession(await convertFromTdata({
            path: tdataPath,
            ignoreVersion: true,
        }));

        return this;
    }

    /** Boot the client and resolve the authorized user. */
    async auth(): Promise<this> {
        if (!this.client) throw new Error('Client is not allocated');
        await this.client.start();
        this.user = await this.client.getMe();
        return this;
    }

    /** Spawn flow: reuse the stored session when present, else import tdata. */
    async connect(tdataPath?: string): Promise<this> {
        await fs.mkdir(this.storagePath, { recursive: true });
        this.allocate();

        if (await this.hasExistingSession()) {
            return this.auth();
        }

        if (tdataPath) {
            await this.importTdata(tdataPath);
            await this.auth();
            // tdata is merged into the session storage; the source copy is no longer needed
            await this.removeTdata();
            return this;
        }

        throw new Error(`Account ${this.opts.accountName} has no stored session and no tdata to import`);
    }

    /** Best-effort session teardown. */
    async disconnect(): Promise<void> {
        try {
            await (this.client as unknown as { destroy?: () => Promise<void> | void } | undefined)?.destroy?.();
        } catch {
            // ignore teardown failures
        }
    }

    private async removeTdata(): Promise<void> {
        if (!this.tdataPath) return;
        await fs.rm(this.tdataPath, { recursive: true, force: true });
        this.tdataPath = undefined;
    }
}
