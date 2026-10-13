import './src/core/autolock';

import { $dbManager } from './src/core/index.js';
import { runMigrations } from './src/schema/index.js';
import { logger } from './src/core/logger.js';
import fs from 'fs';

logger.info({
  time: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
  dataFolderPermission: fs.statSync('./data').mode.toString(8)
}, 'Starting application');

const db = $dbManager.registerDatabase('main', {
  path: './data/app.db',
  create: true
});

runMigrations(db);

import { $hypervisorLayer } from './src/core/hypervisor.layer.js';
await $hypervisorLayer.autoload();

import { WebkitServer } from './webkit';
const webkitServer = new WebkitServer();


import { $campaignLayer } from './src/core/campaign.layer.js';
await $campaignLayer.start();
