import { Command, Args, Flags } from '@oclif/core';
import { logger } from '../core/logger';
import { WebKit } from '@/src/application/webkit';
import { $otel } from '@/src/application/otel';

export default class StartCommand extends Command {
  static description = 'Start the TON bot server and all services';

  static examples = [
    '<%= config.bin %> start',
    '<%= config.bin %> start --no-server --host 0.0.0.0 --port 8080',
    '<%= config.bin %> start --no-tls --no-migrate',
  ];

  static flags = {
    server: Flags.boolean({ description: 'Start web server', default: true, allowNo: true }),
    campaign: Flags.boolean({ description: 'Start campaign layer', default: true, allowNo: true }),
    migrate: Flags.boolean({ description: 'Run database migrations', default: true, allowNo: true }),
    autoload: Flags.boolean({ description: 'Autoload accounts', default: true, allowNo: true }),
    tls: Flags.boolean({ description: 'Enable TLS', default: true, allowNo: true }),
    http3: Flags.boolean({ description: 'Enable HTTP/3 (QUIC)', default: true, allowNo: true }),
    otel: Flags.boolean({ description: 'Enable OpenTelemetry tracing', default: true, allowNo: true }),
    host: Flags.string({ description: 'Bind host', default: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' }),
    port: Flags.integer({ description: 'Bind port', default: 3000 }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StartCommand);

    if (flags.host) process.env.HOST = flags.host;
    if (flags.port) process.env.PORT = String(flags.port);
    process.env.TLS_ENABLED = String(flags.tls);

    logger.info('Starting Telegram Ad Library...');

    if (flags.otel) {
      logger.info('Starting OpenTelemetry...');
      await $otel.start();
    }

    const { runMigrations } = await import('@/src/db/client.js');
    const { $mtOrchestration } = await import('@/src/application/orchestration.js');
    const { $campaignLayer } = await import('@/src/core/campaign.layer.js');

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
}
