import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { env } from '../config/env';
import { generateStorageName } from '../utils/filename';

if (!fs.existsSync(env.uploadDir)) fs.mkdirSync(env.uploadDir, { recursive: true });
if (!fs.existsSync(env.convertedDir)) fs.mkdirSync(env.convertedDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, env.uploadDir),
  filename: (_req, file, cb) => cb(null, generateStorageName(file.originalname)),
});

const limits = {
  fileSize: env.maxFileSizeMb * 1024 * 1024,
  files: env.maxBatchFiles,
};

export const uploadSingle = multer({ storage, limits }).single('file');
export const uploadBatch = multer({ storage, limits }).array('files', env.maxBatchFiles);

export function absoluteUploadPath(filename: string): string {
  return path.join(env.uploadDir, filename);
}

export function absoluteConvertedPath(filename: string): string {
  return path.join(env.convertedDir, filename);
}
