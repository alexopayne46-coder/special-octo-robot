import { Command } from '@oclif/core';

export default class ListCommand extends Command {
  static description = 'List all campaigns';

  static examples = [
    '<%= config.bin %> campaigns:list',
  ];

  async run(): Promise<void> {
    this.log('Campaigns:');
    this.log('  (none)');
  }
}
