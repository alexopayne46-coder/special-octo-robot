import { run } from '@oclif/core';
import { resolve } from 'node:path';

await run(['start', ...process.argv.slice(2)], {
  root: resolve(import.meta.dir, '.'),
});
