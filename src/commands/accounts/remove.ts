import { Command, Args } from '@oclif/core';

export default class RemoveCommand extends Command {
  static description = 'Remove an account';

  static examples = [
    '<%= config.bin %> accounts:remove <name>',
  ];

  static args = {
    name: Args.string({ description: 'Account name', required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(RemoveCommand);
    this.log(`Removing account: ${args.name}`);
    // Implementation would go here
    this.log(`Account "${args.name}" removed successfully`);
  }
}
