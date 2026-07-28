import fs from 'fs/promises';
import path from 'path';
import cron from 'node-cron';
import { env } from '../config/env';
import { logger } from '../utils/logger';

async function cleanupDir(dir: string, maxAgeMs: number): Promise<number> {
  let removed = 0;
  let entries: string[] = [];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }

  const now = Date.now();
  await Promise.all(
    entries.map(async (entry) => {
      const filePath = path.join(dir, entry);
      try {
        const stat = await fs.stat(filePath);
        if (stat.isFile() && now - stat.mtimeMs > maxAgeMs) {
          await fs.unlink(filePath);
          removed += 1;
        }
      } catch {
        // file may have been removed concurrently; ignore
      }
    })
  );
  return removed;
}

export async function runCleanup(): Promise<void> {
  const maxAgeMs = env.retentionMinutes * 60 * 1000;
  const [uploadsRemoved, convertedRemoved] = await Promise.all([
    cleanupDir(env.uploadDir, maxAgeMs),
    cleanupDir(env.convertedDir, maxAgeMs),
  ]);
  if (uploadsRemoved || convertedRemoved) {
    logger.info(`Cleanup removed ${uploadsRemoved} upload(s) and ${convertedRemoved} converted file(s)`);
  }
}

export function scheduleCleanup(): void {
  const cronExpression = `*/${Math.max(1, env.cleanupIntervalMinutes)} * * * *`;
  cron.schedule(cronExpression, () => {
    runCleanup().catch((err) => logger.error('Cleanup job failed', { error: (err as Error).message }));
  });
  logger.info(`Scheduled storage cleanup every ${env.cleanupIntervalMinutes} minute(s), retention ${env.retentionMinutes} minute(s)`);
}
