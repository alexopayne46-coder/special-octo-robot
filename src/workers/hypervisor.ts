// prevents TS errors
// @ts-ignore
declare var self: Worker;

import { $hypervisor } from '../core/hypervisor.js';
import { logger } from '../core/logger.js';
import type { User } from '@mtcute/bun';
import type {
  HypervisorMethod,
  HypervisorRequestMessage,
  HypervisorResponseMessage,
  IRClientInfo,
  IRClientUserInfo,
} from '../core/hypervisor.protocol.js';

type Params = Record<string, any>;

function toSerializable<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, val) => {
      if (typeof val === 'bigint') return val.toString();
      return val;
    })
  ) as T;
}

function describeUser(user: User): IRClientUserInfo {
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

function describeClient(address: string): IRClientInfo | null {
  const irc = $hypervisor.getIRClient(address);
  if (!irc) return null;

  return {
    address,
    me: describeUser(irc.me),
    folders: irc.folders,
  };
}

type Handler = (params: Params) => Promise<unknown> | unknown;

const handlers: Record<HypervisorMethod, Handler> = {
  autoload: (params) => $hypervisor.autoload(params?.configPath),
  spawnIRClient: (params) => $hypervisor.spawnIRClient(params.name, params.path, params.options ?? {}),
  getIRClient: (params) => describeClient(params.address),
  getAllIRClients: () => {
    const clients: Record<string, IRClientInfo> = {};
    for (const address of $hypervisor.getAllIRCAddresses()) {
      const client = describeClient(address);
      if (client) clients[address] = client;
    }
    return clients;
  },
  getAllIRCAddresses: () => $hypervisor.getAllIRCAddresses(),
  removeIRClient: (params) => {
    $hypervisor.removeIRClient(params.address);
    return null;
  },
};

self.onmessage = async (event: MessageEvent) => {
  const request = event.data as HypervisorRequestMessage;
  if (!request || request.type !== 'request') return;

  const respond = (response: HypervisorResponseMessage) => postMessage(response);

  const handler = handlers[request.method];
  if (!handler) {
    respond({
      type: 'response',
      id: request.id,
      ok: false,
      error: `Unknown method: ${String(request.method)}`,
    });
    return;
  }

  try {
    const result = await handler(request.params as Params);
    respond({ type: 'response', id: request.id, ok: true, result: toSerializable(result) });
  } catch (error) {
    respond({
      type: 'response',
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

postMessage({ type: 'ready' });
logger.info('Hypervisor worker ready');
