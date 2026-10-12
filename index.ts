import './src/core/autolock';

import { $campaignLayer } from './src/core/campaign.layer.js';

Promise.all([
  import('./src/loaders/WebServer.js'),
  import('./src/loaders/Hypervisor.js'),
  import('./src/loaders/Database.js')
])

await $campaignLayer.start();

