import { run } from '@oclif/core';

// Explicitly import application entrypoints so bun build includes them in the bundle.
import './src/commands/start.js';

await run(['start', ...process.argv.slice(2)], {
  root: process.cwd(),
});
