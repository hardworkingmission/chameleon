import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { convertFile } from '../services/conversion/convert.service';
import { convertImagesToPdf } from '../services/conversion/pdf.service';
import { MAX_RESIZE_DIMENSION, ResizeOptions } from '../services/conversion/image.service';
import { buildZipStream } from '../services/zip.service';
import { recordConversion } from '../services/history.service';
import { cleanupUploadedFile } from '../middleware/validateFile.middleware';
import { sanitizeOriginalName } from '../utils/filename';
import { normalizeFormat, EXT_TO_MIME } from '../utils/formats';
import { logger } from '../utils/logger';
import { ValidationError } from '../utils/errors';
import { createStorageGroup, storeFiles } from '../services/storage.service';

const RESIZE_FIT_VALUES = new Set(['cover', 'contain', 'fill', 'inside', 'outside']);

function parseQuality(raw: unknown): number | undefined {
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

function parseDimension(raw: unknown, label: string): number | undefined {
  if (raw === undefined || raw === '') return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) throw new ValidationError(`${label} must be a positive number`);
  if (n > MAX_RESIZE_DIMENSION) throw new ValidationError(`${label} must be ${MAX_RESIZE_DIMENSION}px or less`);
  return Math.round(n);
}

function parseResize(body: Record<string, unknown>): ResizeOptions | undefined {
  const width = parseDimension(body.width, 'width');
  const height = parseDimension(body.height, 'height');
  if (!width && !height) return undefined;
  const fit = typeof body.fit === 'string' && RESIZE_FIT_VALUES.has(body.fit) ? (body.fit as ResizeOptions['fit']) : undefined;
  return { width, height, fit };
}

function baseName(filename: string): string {
  return path.basename(filename, path.extname(filename));
}

export async function convertSingle(req: Request, res: Response, next: NextFunction) {
  const file = req.file!;
  const detectedFormat = (req as any).detectedFormat as string;
  const targetFormat = normalizeFormat(req.body.targetFormat);
  const quality = parseQuality(req.body.quality);
  const keepMetadata = req.body.keepMetadata === 'true';
  const originalName = sanitizeOriginalName(file.originalname);

  try {
    const resize = parseResize(req.body);
    const inputBuffer = await fs.readFile(file.path);
    const storageGroup = createStorageGroup();
    await storeFiles(storageGroup, 'originals', [{ name: originalName, buffer: inputBuffer,
      contentType: EXT_TO_MIME[detectedFormat] ?? 'application/octet-stream' }]);
    const result = await convertFile(inputBuffer, detectedFormat, targetFormat, { quality, keepMetadata, resize });
    await storeFiles(storageGroup, 'converted', result.buffers.map((b, i) => ({
      name: `${baseName(originalName)}${b.suffix || (result.buffers.length > 1 ? `-${i + 1}` : '')}.${targetFormat}`,
      buffer: b.buffer,
      contentType: EXT_TO_MIME[targetFormat] ?? 'application/octet-stream',
    })));

    if (req.auth) {
      await recordConversion({
        userId: req.auth.userId,
        originalFilename: originalName,
        sourceFormat: detectedFormat,
        targetFormat,
        fileSizeBytes: file.size,
        status: 'SUCCESS',
      });
    }

    if (result.buffers.length === 1) {
      const outName = `${baseName(originalName)}.${targetFormat}`;
      res.setHeader('Content-Type', EXT_TO_MIME[targetFormat] ?? 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${outName}"`);
      res.send(result.buffers[0].buffer);
    } else {
      const entries = result.buffers.map((b, i) => ({
        name: `${baseName(originalName)}${b.suffix || `-${i + 1}`}.${targetFormat}`,
        buffer: b.buffer,
      }));
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${baseName(originalName)}.zip"`);
      buildZipStream(entries).pipe(res);
    }
  } catch (err) {
    if (req.auth) {
      await recordConversion({
        userId: req.auth.userId,
        originalFilename: originalName,
        sourceFormat: detectedFormat ?? 'unknown',
        targetFormat,
        fileSizeBytes: file.size,
        status: 'FAILED',
        errorMessage: (err as Error).message,
      }).catch((e) => logger.error('Failed to record conversion history', { error: e.message }));
    }
    next(err);
  } finally {
    await cleanupUploadedFile(file.path);
  }
}

export async function convertBatch(req: Request, res: Response, next: NextFunction) {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const detectedFormats = (req as any).detectedFormats as Record<string, string>;
  const targetFormat = normalizeFormat(req.body.targetFormat);
  const quality = parseQuality(req.body.quality);
  const keepMetadata = req.body.keepMetadata === 'true';

  const zipEntries: { name: string; buffer: Buffer }[] = [];
  const errors: { file: string; error: string }[] = [];

  try {
    const resize = parseResize(req.body);
    for (const file of files) {
      const originalName = sanitizeOriginalName(file.originalname);
      const detected = detectedFormats[file.path];
      try {
        if (detected === 'INVALID') {
          throw new Error('Unsupported or corrupt file');
        }
        const inputBuffer = await fs.readFile(file.path);
        const storageGroup = createStorageGroup();
        await storeFiles(storageGroup, 'originals', [{ name: originalName, buffer: inputBuffer,
          contentType: EXT_TO_MIME[detected] ?? 'application/octet-stream' }]);
        const result = await convertFile(inputBuffer, detected, targetFormat, { quality, keepMetadata, resize });
        await storeFiles(storageGroup, 'converted', result.buffers.map((b, i) => ({
          name: `${baseName(originalName)}${b.suffix || (result.buffers.length > 1 ? `-${i + 1}` : '')}.${targetFormat}`,
          buffer: b.buffer,
          contentType: EXT_TO_MIME[targetFormat] ?? 'application/octet-stream',
        })));

        result.buffers.forEach((b, i) => {
          zipEntries.push({
            name: `${baseName(originalName)}${b.suffix || (result.buffers.length > 1 ? `-${i + 1}` : '')}.${targetFormat}`,
            buffer: b.buffer,
          });
        });

        if (req.auth) {
          await recordConversion({
            userId: req.auth.userId,
            originalFilename: originalName,
            sourceFormat: detected,
            targetFormat,
            fileSizeBytes: file.size,
            status: 'SUCCESS',
          });
        }
      } catch (err) {
        errors.push({ file: originalName, error: (err as Error).message });
        if (req.auth) {
          await recordConversion({
            userId: req.auth.userId,
            originalFilename: originalName,
            sourceFormat: detected ?? 'unknown',
            targetFormat,
            fileSizeBytes: file.size,
            status: 'FAILED',
            errorMessage: (err as Error).message,
          }).catch((e) => logger.error('Failed to record conversion history', { error: e.message }));
        }
      }
    }

    if (errors.length > 0) {
      zipEntries.push({ name: 'errors.json', buffer: Buffer.from(JSON.stringify(errors, null, 2)) });
    }

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="chameleon-batch.zip"');
    buildZipStream(zipEntries).pipe(res);
  } catch (err) {
    next(err);
  } finally {
    await Promise.all(files.map((f) => cleanupUploadedFile(f.path)));
  }
}

/**
 * Special-case endpoint: combine multiple uploaded images into a single PDF
 * (rather than converting each file independently).
 */
export async function convertImagesToSinglePdf(req: Request, res: Response, next: NextFunction) {
  const files = (req.files as Express.Multer.File[]) ?? [];
  const detectedFormats = (req as any).detectedFormats as Record<string, string>;

  try {
    const images = await Promise.all(
      files.map(async (file) => ({
        buffer: await fs.readFile(file.path),
        format: detectedFormats[file.path],
      }))
    );
    const invalid = images.find((i) => i.format === 'INVALID' || !i.format);
    if (invalid) throw new Error('One or more files are not supported images');

    const resize = parseResize(req.body);
    const storageGroup = createStorageGroup();
    await storeFiles(storageGroup, 'originals', images.map((image, i) => ({
      name: sanitizeOriginalName(files[i].originalname), buffer: image.buffer,
      contentType: EXT_TO_MIME[image.format] ?? 'application/octet-stream',
    })));
    const pdfBuffer = await convertImagesToPdf(images, resize);
    await storeFiles(storageGroup, 'converted', [{ name: 'chameleon-merged.pdf', buffer: pdfBuffer,
      contentType: 'application/pdf' }]);

    if (req.auth) {
      await Promise.all(
        files.map((file, i) =>
          recordConversion({
            userId: req.auth!.userId,
            originalFilename: sanitizeOriginalName(file.originalname),
            sourceFormat: images[i].format,
            targetFormat: 'pdf',
            fileSizeBytes: file.size,
            status: 'SUCCESS',
          })
        )
      );
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="chameleon-merged.pdf"');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  } finally {
    await Promise.all(files.map((f) => cleanupUploadedFile(f.path)));
  }
}
