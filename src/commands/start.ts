import { logger } from '../core/logger.js';
import { WebKit } from '../application/webkit.js';
import { $otel } from '../application/otel.js';
import { parseStartFlags } from '../args.js';

export async function start() {
  const flags = parseStartFlags(process.argv.slice(2));

  if (flags.host) process.env.HOST = flags.host;
  if (flags.port) process.env.PORT = String(flags.port);
  process.env.TLS_ENABLED = String(flags.tls);

  logger.info('Starting Telegram Ad Library...');

  if (flags.otel) {
    logger.info('Starting OpenTelemetry...');
    await $otel.start();
  }

  const { runMigrations } = await import('../db/client.js');
  const { $mtOrchestration } = await import('../application/orchestration.js');
  const { $campaignLayer } = await import('../core/campaign.layer.js');

  if (flags.migrate) {
    logger.info('Running migrations...');
    await runMigrations();
  }

  if (flags.autoload) {
    logger.info('Autoloading accounts...');
    await $mtOrchestration.autoload();
  }

  if (flags.campaign) {
    logger.info('Starting campaign layer...');
    await $campaignLayer.start();
  }

  if (flags.server) {
    logger.info(`Starting web server on ${flags.host}:${flags.port}...`);
    const webkit = new WebKit();
    await webkit.start({ tls: flags.tls, http3: flags.http3 });
  }

  logger.info('TON bot started successfully');
}
