import { Command, Args } from '@oclif/core';

export default class CreateCommand extends Command {
  static description = 'Create a new campaign';

  static examples = [
    '<%= config.bin %> campaigns:create <name>',
  ];

  static args = {
    name: Args.string({ description: 'Campaign name', required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(CreateCommand);
    this.log(`Creating campaign: ${args.name}`);
    // Implementation would go here
    this.log(`Campaign "${args.name}" created successfully`);
  }
}
