import './otel.js';
import 'dotenv/config';

import { initializeLock } from './src/core/lockfile.js';
import { $hypervisorLayer } from './src/core/hypervisor.layer.js';
import { $campaignLayer } from './src/core/campaign.layer.js';
import { $dbManager, SQLiteDatabase } from './src/core/index.js';
import { LookALikeUserRepository } from './src/models/lookalike-user.js';
import { runMigrations } from './src/schema/index.js';
import { logger } from './src/core/logger.js';
import { IBot } from './src/core/bot.js';
import { HttpPlayAdapter } from './src/adapters/http-play/adapter.js';

await initializeLock();
await $hypervisorLayer.autoload();

// Initialize HTTP Play Adapter
const httpPlayAdapter = new HttpPlayAdapter();
logger.info('HttpPlayAdapter initialized');

const db = $dbManager.registerDatabase('main', {
  path: './data/app.db',
  create: true
});

runMigrations(db);

await import('./webkit/index');

// Campaign watcher worker: watches ad_campaigns statuses
await $campaignLayer.start();
