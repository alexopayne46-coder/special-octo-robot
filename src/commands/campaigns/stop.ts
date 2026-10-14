import { Command, Args } from '@oclif/core';

export default class StopCommand extends Command {
  static description = 'Stop a campaign';

  static examples = [
    '<%= config.bin %> campaigns:stop <id>',
  ];

  static args = {
    id: Args.integer({ description: 'Campaign ID', required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(StopCommand);
    this.log(`Stopping campaign: ${args.id}`);
    // Implementation would go here
    this.log(`Campaign ${args.id} stopped successfully`);
  }
}
