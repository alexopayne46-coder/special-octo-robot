import { $mtOrchestration } from './src/application/orchestration.js';
import { $campaignLayer } from './src/core/campaign.layer.js';
import { $webKitServer } from './webkit';

import { runMigrations } from '@/src/db/client';

await runMigrations();

await $mtOrchestration.autoload();

await $campaignLayer.start();
await $webKitServer.start()