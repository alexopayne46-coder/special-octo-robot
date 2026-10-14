import { Command } from '@oclif/core';

export default class AccountsCommand extends Command {
  static description = 'Manage bot accounts';

  static examples = [
    '<%= config.bin %> accounts:list',
    '<%= config.bin %> accounts:add <name>',
    '<%= config.bin %> accounts:remove <name>',
  ];

  static subcommands = {
    list: require('./accounts/list.ts').default,
    add: require('./accounts/add.ts').default,
    remove: require('./accounts/remove.ts').default,
  };

  static flags = {};
}
