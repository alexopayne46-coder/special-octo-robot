import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from './logger.js';

const LOCK_FILE = path.join(process.cwd(), '.app.lock');

async function acquireLock() {
  try {
    await fs.writeFile(LOCK_FILE, process.pid.toString(), { flag: 'wx' });
    return async () => {
      try {
        await fs.unlink(LOCK_FILE);
      } catch {}
    };
  } catch (error: any) {
    if (error.code === 'EEXIST') {
      const pid = await fs.readFile(LOCK_FILE, 'utf-8');
      try {
        process.kill(parseInt(pid), 0);
        throw new Error('Another instance is already running');
      } catch {
        await fs.unlink(LOCK_FILE);
        return await acquireLock();
      }
    }
    throw error;
  }
}

let releaseLock: (() => Promise<void>) | null = null;

export async function initializeLock() {
  try {
    releaseLock = await acquireLock();
    logger.info('Lock acquired successfully');
  } catch (error: any) {
    logger.error('Failed to acquire lock:', error.message);
    process.exit(1);
  }

  process.on('SIGTERM', async () => {
    if (releaseLock) {
      await releaseLock();
    }
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    if (releaseLock) {
      await releaseLock();
    }
    process.exit(0);
  });
}
