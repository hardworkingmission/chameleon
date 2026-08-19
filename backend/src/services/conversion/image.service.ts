import sharp from 'sharp';
import { CorruptFileError, ValidationError } from '../../utils/errors';
import { ImageFormat, isLossyQualityFormat } from '../../utils/formats';

export const MAX_RESIZE_DIMENSION = 8000;

export interface ResizeOptions {
  width?: number;
  height?: number;
  fit?: keyof sharp.FitEnum; // 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
}

export interface ImageConvertOptions {
  quality?: number; // 1-100, applies to lossy formats
  keepMetadata?: boolean;
  resize?: ResizeOptions;
  maxSizeBytes?: number; // compress to fit under this size; see compressToTargetSize
}

function applyResize(pipeline: sharp.Sharp, resize?: ResizeOptions): sharp.Sharp {
  if (!resize || (!resize.width && !resize.height)) return pipeline;
  return pipeline.resize(resize.width, resize.height, {
    fit: resize.fit ?? 'inside',
    withoutEnlargement: true,
  });
}

/**
 * Resizes an image while preserving its original encoding (used to resize
 * source images before embedding them into a PDF, where no format
 * conversion is otherwise happening).
 */
export async function resizeImage(input: Buffer, resize: ResizeOptions): Promise<Buffer> {
  if (!resize.width && !resize.height) return input;
  try {
    const pipeline = applyResize(sharp(input, { failOn: 'error' }).rotate(), resize);
    return await pipeline.toBuffer();
  } catch (err) {
    if (err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to resize image — the file may be corrupt or malformed');
  }
}

const SHARP_FORMAT: Record<ImageFormat, keyof sharp.FormatEnum> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  webp: 'webp',
  gif: 'gif',
  bmp: 'tiff', // sharp has no native bmp encoder; see convertImage fallback note
  tiff: 'tiff',
  avif: 'avif',
};

export async function convertImage(
  input: Buffer,
  targetFormat: ImageFormat,
  options: ImageConvertOptions = {}
): Promise<Buffer> {
  if (options.maxSizeBytes) {
    return compressToTargetSize(input, targetFormat, options.maxSizeBytes, options);
  }

  try {
    // sharp strips EXIF/metadata on output by default; only re-attach it
    // when the caller explicitly opts in via keepMetadata.
    let pipeline = sharp(input, { failOn: 'error' }).rotate();
    if (options.keepMetadata) {
      pipeline = pipeline.withMetadata();
    }
    pipeline = applyResize(pipeline, options.resize);

    const quality = options.quality ? Math.min(100, Math.max(1, options.quality)) : undefined;

    switch (targetFormat) {
      case 'jpg':
      case 'jpeg':
        return await pipeline.jpeg({ quality: quality ?? 85 }).toBuffer();
      case 'webp':
        return await pipeline.webp({ quality: quality ?? 85 }).toBuffer();
      case 'avif':
        return await pipeline.avif({ quality: quality ?? 60 }).toBuffer();
      case 'png':
        return await pipeline.png().toBuffer();
      case 'gif':
        return await pipeline.gif().toBuffer();
      case 'tiff':
        return await pipeline.tiff().toBuffer();
      case 'bmp':
        // sharp cannot encode BMP directly; produce a raw pixel buffer and wrap it in a BMP header.
        return await encodeBmp(pipeline);
      default:
        throw new CorruptFileError(`Unsupported image target format: ${targetFormat}`);
    }
  } catch (err) {
    if (err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to process image — the file may be corrupt or malformed');
  }
}

type LossyQualityFormat = 'jpg' | 'jpeg' | 'webp' | 'avif';

async function encodeAtQualityAndScale(
  input: Buffer,
  targetFormat: LossyQualityFormat,
  quality: number,
  scale: number,
  options: ImageConvertOptions,
  baseWidth: number
): Promise<Buffer> {
  let pipeline = sharp(input, { failOn: 'error' }).rotate();
  if (options.keepMetadata) pipeline = pipeline.withMetadata();
  pipeline = applyResize(pipeline, options.resize);
  if (scale < 1) {
    pipeline = pipeline.resize({ width: Math.max(20, Math.round(baseWidth * scale)) });
  }
  switch (targetFormat) {
    case 'jpg':
    case 'jpeg':
      return pipeline.jpeg({ quality }).toBuffer();
    case 'webp':
      return pipeline.webp({ quality }).toBuffer();
    case 'avif':
      return pipeline.avif({ quality }).toBuffer();
  }
}

/**
 * Binary-searches the quality setting (and, if needed, progressively
 * downscales) so the encoded output fits under maxSizeBytes. Falls back to
 * the smallest result produced if the target truly can't be reached.
 */
export async function compressToTargetSize(
  input: Buffer,
  targetFormat: ImageFormat,
  maxSizeBytes: number,
  options: ImageConvertOptions = {}
): Promise<Buffer> {
  if (!isLossyQualityFormat(targetFormat)) {
    throw new ValidationError('Compressing to a target size is only supported for jpg, webp, or avif output');
  }
  const format = targetFormat as LossyQualityFormat;

  try {
    const meta = await sharp(input).metadata();
    const baseWidth = options.resize?.width ?? meta.width ?? 1600;

    const scales = [1, 0.85, 0.7, 0.55, 0.4, 0.25];
    let fallback: Buffer | null = null;

    for (const scale of scales) {
      let low = 1;
      let high = 100;
      let found: Buffer | null = null;

      while (low <= high) {
        const mid = Math.floor((low + high) / 2);
        const candidate = await encodeAtQualityAndScale(input, format, mid, scale, options, baseWidth);
        if (candidate.length <= maxSizeBytes) {
          found = candidate;
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }

      if (found) return found;
      fallback = await encodeAtQualityAndScale(input, format, 1, scale, options, baseWidth);
    }

    // Even the smallest scale at minimum quality still exceeds the target;
    // return the smallest result produced as a best effort.
    return fallback!;
  } catch (err) {
    if (err instanceof ValidationError || err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to compress image — the file may be corrupt or malformed');
  }
}

async function encodeBmp(pipeline: sharp.Sharp): Promise<Buffer> {
  const { data, info } = await pipeline.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const rowSize = Math.ceil((width * 4) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = 54 + pixelArraySize;

  const buffer = Buffer.alloc(fileSize);
  buffer.write('BM', 0);
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(54, 10); // pixel data offset
  buffer.writeUInt32LE(40, 14); // DIB header size
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(-height, 22); // negative = top-down
  buffer.writeUInt16LE(1, 26); // planes
  buffer.writeUInt16LE(32, 28); // bits per pixel
  buffer.writeUInt32LE(0, 30); // no compression
  buffer.writeUInt32LE(pixelArraySize, 34);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = 54 + y * rowSize + x * 4;
      buffer[dstIdx] = data[srcIdx + 2]; // B
      buffer[dstIdx + 1] = data[srcIdx + 1]; // G
      buffer[dstIdx + 2] = data[srcIdx]; // R
      buffer[dstIdx + 3] = data[srcIdx + 3]; // A
    }
  }

  return buffer;
}

export async function getImageMetadata(input: Buffer) {
  return sharp(input).metadata();
}
