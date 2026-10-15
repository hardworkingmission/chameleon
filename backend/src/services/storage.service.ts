import { randomUUID } from 'crypto';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../config/env';
import { sanitizeOriginalName } from '../utils/filename';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export interface StoredFile {
  name: string;
  buffer: Buffer;
  contentType: string;
}

let client: S3Client | undefined;

/** A unique group keeps originals and outputs together without filename collisions. */
export function createStorageGroup(): string {
  return `chameleon/${new Date().toISOString().slice(0, 10)}/${randomUUID()}`;
}

/** Local mode retains the existing temporary-file behavior. S3 objects are never auto-deleted. */
export async function storeFiles(group: string, kind: 'originals' | 'converted', files: StoredFile[]): Promise<void> {
  if (env.storageDriver !== 's3') return;
  client ??= new S3Client({ region: env.s3Region, maxAttempts: 3 });
  for (const [index, file] of files.entries()) {
    const key = `${group}/${kind}/${index + 1}-${sanitizeOriginalName(file.name)}`;
    try {
      await client.send(new PutObjectCommand({
        Bucket: env.s3Bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.contentType,
        // No public ACL, expiry, or delete operation. Bucket encryption defaults apply.
      }), { abortSignal: AbortSignal.timeout(60_000) });
    } catch (error) {
      logger.error('S3 storage failed', { group, kind, error: (error as Error).name });
      throw new AppError('Unable to save files to storage. Please try again.', 503);
    }
  }
}
