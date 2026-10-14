import { Command, Flags } from '@oclif/core';

export default class ListCommand extends Command {
  static description = 'List all registered accounts';

  static examples = [
    '<%= config.bin %> accounts:list',
    '<%= config.bin %> accounts:list --verbose',
  ];

  static flags = {
    verbose: Flags.boolean({ char: 'v', description: 'Show detailed information' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(ListCommand);
    this.log('Registered accounts:');
    this.log('  (none)');
    if (flags.verbose) {
      this.log('No accounts found');
    }
  }
}
