import { Command } from '@oclif/core';

export default class CampaignsCommand extends Command {
  static description = 'Manage ad campaigns';

  static examples = [
    '<%= config.bin %> campaigns:list',
    '<%= config.bin %> campaigns:create <name>',
    '<%= config.bin %> campaigns:start <id>',
    '<%= config.bin %> campaigns:stop <id>',
  ];

  static subcommands = {
    list: require('./campaigns/list.ts').default,
    create: require('./campaigns/create.ts').default,
    start: require('./campaigns/start.ts').default,
    stop: require('./campaigns/stop.ts').default,
  };

  static flags = {};
}
