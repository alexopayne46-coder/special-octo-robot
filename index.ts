import './src/core/autolock';

import { $hypervisorLayer } from './src/core/hypervisor.layer.js';
import { $campaignLayer } from './src/core/campaign.layer.js';
import { $dbManager } from './src/core/index.js';
import { runMigrations } from './src/schema/index.js';

Promise.all([
  import('./src/loaders/WebServer.js'),
  import('./src/loaders/Hypervisor.js'),
  import('./src/loaders/Database.js')
])



await $campaignLayer.start();

