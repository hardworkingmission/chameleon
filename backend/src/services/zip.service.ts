import archiver from 'archiver';
import { PassThrough } from 'stream';

export interface ZipEntry {
  name: string;
  buffer: Buffer;
}

export function buildZipStream(entries: ZipEntry[]): PassThrough {
  const output = new PassThrough();
  const archive = archiver('zip', { zlib: { level: 9 } });

  archive.on('error', (err) => output.emit('error', err));
  archive.pipe(output);

  for (const entry of entries) {
    archive.append(entry.buffer, { name: entry.name });
  }

  archive.finalize();
  return output;
}
