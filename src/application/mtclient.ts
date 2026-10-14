import type { User } from '@mtcute/bun';
import { MtCore, type IMtClientCreation } from './mtcore.js';

export interface MtUserInfo {
    id: number;
    displayName: string;
    firstName: string;
    lastName: string | null;
    username: string | null;
    phoneNumber: string | null;
    isBot: boolean;
    isSelf: boolean;
    isPremium: boolean;
    status: string;
    lastOnline: string | null;
}

export interface MtAccountInfo {
    address: string;
    me: MtUserInfo | null;
    folders: {
        storage: string;
        importTdata?: string;
    } | null;
}

function describeUser(user: User): MtUserInfo {
    return {
        id: user.id,
        displayName: user.displayName,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        phoneNumber: user.phoneNumber,
        isBot: user.isBot,
        isSelf: user.isSelf,
        isPremium: user.isPremium,
        status: user.status,
        lastOnline: user.lastOnline ? user.lastOnline.toISOString() : null,
    };
}

export class MtClient extends MtCore {
    constructor(
        private readonly address: string,
        opts: IMtClientCreation,
    ) {
        super(opts);
    }

    getAddress(): string {
        return this.address;
    }

    getMe(): User | undefined {
        return this.user;
    }

    describe(): MtAccountInfo {
        return {
            address: this.address,
            me: this.user ? describeUser(this.user) : null,
            folders: {
                storage: this.storagePath,
                ...(this.tdataPath ? { importTdata: this.tdataPath } : {}),
            },
        };
    }

    async sendText(username: string, text: string): Promise<unknown> {
        if (!this.client) throw new Error(`Client ${this.address} is not allocated`);

        const peer = await this.client.resolvePeer(username);
        return this.client.sendText(peer, text);
    }

    async setMyUsername(username: string): Promise<unknown> {
        if (!this.client) throw new Error(`Client ${this.address} is not allocated`);
        return this.client.setMyUsername(username);
    }
}
