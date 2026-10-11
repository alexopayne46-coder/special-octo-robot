import type { RpcReadyMessage, RpcRequestMessage, RpcResponseMessage, RpcWorkerMessage } from './worker.rpc.js';

export interface IRClientUserInfo {
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

export interface IRClientInfo {
  address: string;
  me: IRClientUserInfo | null;
  folders: {
    storage: string;
    importTdata?: string;
  } | null;
}

export type HypervisorMethod =
  | 'autoload'
  | 'spawnIRClient'
  | 'getIRClient'
  | 'getAllIRClients'
  | 'getAllIRCAddresses'
  | 'removeIRClient';

export type HypervisorRequestMessage = RpcRequestMessage<HypervisorMethod>;

export type HypervisorResponseMessage = RpcResponseMessage;

export type HypervisorReadyMessage = RpcReadyMessage;

export type HypervisorWorkerMessage = RpcWorkerMessage;
