import { Request, Response, NextFunction } from 'express';
import fs from 'fs/promises';
import { isSupportedSourceFormat, isSupportedTargetFormat, normalizeFormat, MIME_TO_EXT } from '../utils/formats';
import { UnsupportedFormatError, ValidationError, CorruptFileError } from '../utils/errors';
import { cachedDynamicImport } from '../utils/dynamicImport';

// file-type is ESM-only; import lazily so it works under CommonJS output.
async function detectFormat(filePath: string): Promise<string | undefined> {
  const { fileTypeFromFile } = await cachedDynamicImport('file-type');
  const result = await fileTypeFromFile(filePath);
  if (!result) return undefined;
  return MIME_TO_EXT[result.mime] ?? result.ext;
}

async function sniffAndCheck(filePath: string): Promise<string> {
  let detected: string | undefined;
  try {
    detected = await detectFormat(filePath);
  } catch {
    throw new CorruptFileError('Unable to read file contents');
  }
  if (!detected) {
    throw new UnsupportedFormatError('Could not determine file type from its contents');
  }
  if (!isSupportedSourceFormat(detected)) {
    throw new UnsupportedFormatError(`Detected file type "${detected}" is not supported`);
  }
  return normalizeFormat(detected);
}

function hasProcessingParams(body: Record<string, unknown>): boolean {
  const hasValue = (key: string) => body[key] !== undefined && body[key] !== '';
  return hasValue('width') || hasValue('height') || hasValue('maxSizeKB') || body.stripMetadata === 'true';
}

// targetFormat is optional: a request with only width/height (resize),
// maxSizeKB (compress to a target size), or stripMetadata (re-save as-is)
// keeps the source format. At least one action must be present, otherwise
// there's nothing to do.
function validateTargetFormat(body: Record<string, unknown>): void {
  const targetFormat = body.targetFormat;
  if (!targetFormat) {
    if (!hasProcessingParams(body)) {
      throw new ValidationError(
        'Provide a targetFormat, or width/height/maxSizeKB/stripMetadata to process without converting'
      );
    }
    return;
  }
  if (!isSupportedTargetFormat(targetFormat as string)) {
    throw new UnsupportedFormatError(`Target format "${targetFormat}" is not supported`);
  }
}

export async function validateSingleFile(req: Request, _res: Response, next: NextFunction) {
  try {
    if (!req.file) throw new ValidationError('No file uploaded');
    validateTargetFormat(req.body);
    const detected = await sniffAndCheck(req.file.path);
    (req as any).detectedFormat = detected;
    next();
  } catch (err) {
    next(err);
  }
}

export function validateBatchFiles(options: { requireTargetFormat?: boolean } = {}) {
  const { requireTargetFormat = true } = options;
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const files = (req.files as Express.Multer.File[]) ?? [];
      if (files.length === 0) throw new ValidationError('No files uploaded');
      if (requireTargetFormat) validateTargetFormat(req.body);
      const detectedFormats: Record<string, string> = {};
      for (const file of files) {
        try {
          detectedFormats[file.path] = await sniffAndCheck(file.path);
        } catch {
          // Defer per-file validity errors to the batch controller so one bad
          // file doesn't reject the whole batch; mark as invalid instead.
          detectedFormats[file.path] = 'INVALID';
        }
      }
      (req as any).detectedFormats = detectedFormats;
      next();
    } catch (err) {
      next(err);
    }
  };
}

export async function cleanupUploadedFile(filePath?: string) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // already removed or never existed; ignore
  }
}
