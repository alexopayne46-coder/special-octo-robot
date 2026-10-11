// prevents TS errors
// @ts-ignore
declare var self: Worker;

import { CampaignWatcher } from '../core/campaign.watcher.js';
import { CampaignLifecycleManager } from '../lifecycles/campaign.lifecycle.manager.js';
import { WorkerRpcHostClient } from '../core/worker.rpc.js';
import { logger } from '../core/logger.js';
import type { IRClientInfo } from '../core/hypervisor.protocol.js';

const host = new WorkerRpcHostClient();

const watcher = new CampaignWatcher();
const lifecycleManager = new CampaignLifecycleManager(watcher.dbPath, (addresses) =>
  host.call<IRClientInfo[]>('getAccounts', { addresses })
);

watcher.setChangeListener((change) => lifecycleManager.handleChange(change));

host.registerHandler('start', () => {
  watcher.start();
  return watcher.isRunning();
});

host.registerHandler('stop', () => {
  watcher.stop();
  return watcher.isRunning();
});

host.registerHandler('getSnapshot', () => watcher.getSnapshot());

host.registerHandler('isRunning', () => watcher.isRunning());

host.registerHandler('getLifecycles', () =>
  lifecycleManager.getLifecycles().map((lifecycle) => lifecycle.describe())
);

postMessage({ type: 'ready' });
logger.info('Campaign worker ready');
