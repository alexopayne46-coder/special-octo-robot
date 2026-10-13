import fs from 'fs';

import './src/core/autolock';

import { $dbManager } from './src/core/index.js';
import { runMigrations } from './src/schema/index.js';
import { logger } from './src/core/logger.js';

logger.info({
  time: new Date().toISOString(),
  env: process.env.NODE_ENV || 'development',
  dataFolderPermission: fs.statSync('./data').mode.toString(8),
  pwd: process.cwd(),
  certsFolderExists: fs.existsSync('./data/certs'),
  keyFileExists: fs.existsSync('./data/certs/key.pem'),
  certFileExists: fs.existsSync('./data/certs/cert.pem'),
}, 'Starting application');

const db = $dbManager.registerDatabase('main', {
  path: './data/app.db',
  create: true
});

runMigrations(db);

import { WebkitServer } from './webkit';
const webkitServer = new WebkitServer();

import { $hypervisorLayer } from './src/core/hypervisor.layer.js';
await $hypervisorLayer.autoload();


import { $campaignLayer } from './src/core/campaign.layer.js';
await $campaignLayer.start();
