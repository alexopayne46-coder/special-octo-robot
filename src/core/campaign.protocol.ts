import type { RpcReadyMessage, RpcRequestMessage, RpcResponseMessage, RpcWorkerMessage } from './worker.rpc.js';

export interface CampaignSnapshot {
  id: number;
  name: string;
  status: string;
  updatedAt: string | null;
}

export interface CampaignLifecycleInfo {
  id: number;
  name: string;
  campaignType: string;
  status: string;
  disposed: boolean;
}

export type CampaignWatcherMethod =
  | 'start'
  | 'stop'
  | 'getSnapshot'
  | 'isRunning'
  | 'getLifecycles';

export type CampaignRequestMessage = RpcRequestMessage<CampaignWatcherMethod>;

export type CampaignResponseMessage = RpcResponseMessage;

export type CampaignReadyMessage = RpcReadyMessage;

export type CampaignWorkerMessage = RpcWorkerMessage;
