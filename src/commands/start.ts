import { Command, Args, Flags } from '@oclif/core';

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
    host: Flags.string({ description: 'Bind host', default: process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost' }),
    port: Flags.integer({ description: 'Bind port', default: 3000 }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StartCommand);

    if (flags.host) process.env.HOST = flags.host;
    if (flags.port) process.env.PORT = String(flags.port);
    process.env.TLS_ENABLED = String(flags.tls);

    this.log(`Starting TON bot...`);

    const { runMigrations } = await import('@/src/db/client.js');
    const { $mtOrchestration } = await import('@/src/application/orchestration.js');
    const { $campaignLayer } = await import('@/src/core/campaign.layer.js');
    const { $webKitServer } = await import('@/webkit');

    if (flags.migrate) {
      this.log('Running migrations...');
      await runMigrations();
    }

    if (flags.autoload) {
      this.log('Autoloading accounts...');
      await $mtOrchestration.autoload();
    }

    if (flags.campaign) {
      this.log('Starting campaign layer...');
      await $campaignLayer.start();
    }

    if (flags.server) {
      this.log(`Starting web server on ${flags.host}:${flags.port}...`);
      await $webKitServer.start();
    }

    this.log('TON bot started successfully');
  }
}
