import sanitize from 'sanitize-filename';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export function sanitizeOriginalName(name: string): string {
  const base = sanitize(name) || 'file';
  return base.slice(0, 200);
}

export function generateStorageName(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  return `${uuidv4()}${ext}`;
}
