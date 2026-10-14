import { Command } from '@oclif/core';

export default class DbCommand extends Command {
  static description = 'Database operations';

  static examples = [
    '<%= config.bin %> db:migrate',
    '<%= config.bin %> db:seed',
    '<%= config.bin %> db:studio',
  ];

  static subcommands = {
    migrate: require('./db/migrate.ts').default,
    seed: require('./db/seed.ts').default,
    studio: require('./db/studio.ts').default,
  };

  static flags = {};
}
