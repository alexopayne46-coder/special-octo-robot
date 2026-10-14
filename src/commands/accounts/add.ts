import { Command, Args } from '@oclif/core';

export default class AddCommand extends Command {
  static description = 'Add a new account';

  static examples = [
    '<%= config.bin %> accounts:add <name>',
  ];

  static args = {
    name: Args.string({ description: 'Account name', required: true }),
  };

  async run(): Promise<void> {
    const { args } = await this.parse(AddCommand);
    this.log(`Adding account: ${args.name}`);
    // Implementation would go here
    this.log(`Account "${args.name}" added successfully`);
  }
}
