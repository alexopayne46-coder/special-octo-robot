import { Command, Flags } from '@oclif/core';

export default class StatusCommand extends Command {
  static description = 'Check the status of the bot and its services';

  static examples = [
    '<%= config.bin %> status',
    '<%= config.bin %> status --verbose',
  ];

  static flags = {
    verbose: Flags.boolean({ char: 'v', description: 'Show detailed status' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(StatusCommand);
    this.log('TON Bot Status:');
    this.log('  Services: running');
    if (flags.verbose) {
      this.log('  Accounts: 0');
      this.log('  Campaigns: 0');
    }
  }
}
