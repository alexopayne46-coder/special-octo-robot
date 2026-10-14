import { Command } from '@oclif/core';

export default class SeedCommand extends Command {
  static description = 'Seed the database';

  static examples = [
    '<%= config.bin %> db:seed',
  ];

  async run(): Promise<void> {
    this.log('Seeding database...');
    // Implementation would go here
    this.log('Database seeded successfully');
  }
}
