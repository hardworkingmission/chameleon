import { isHeicFormat, isImageFormat, isPdfFormat, ImageFormat, normalizeFormat } from '../../utils/formats';
import { UnsupportedFormatError, ValidationError } from '../../utils/errors';
import { convertImage, ResizeOptions } from './image.service';
import { convertHeic } from './heic.service';
import { convertPdfToImages, convertImagesToPdf, PdfPageImage } from './pdf.service';

export interface ConvertOptions {
  quality?: number;
  keepMetadata?: boolean;
  resize?: ResizeOptions;
  maxSizeBytes?: number;
}

export interface ConvertResult {
  buffers: { buffer: Buffer; suffix: string }[];
}

/**
 * Converts a single input file's buffer according to its detected source
 * format and the requested target format. Returns one or more output
 * buffers (PDF-to-image produces one buffer per page).
 */
export async function convertFile(
  input: Buffer,
  sourceFormat: string,
  targetFormat: string,
  options: ConvertOptions = {}
): Promise<ConvertResult> {
  const source = normalizeFormat(sourceFormat);
  const target = normalizeFormat(targetFormat);

  if (isPdfFormat(source) && isImageFormat(target)) {
    const pages: PdfPageImage[] = await convertPdfToImages(input, target as ImageFormat, options);
    return {
      buffers: pages.map((p) => ({ buffer: p.buffer, suffix: pages.length > 1 ? `-page-${p.page}` : '' })),
    };
  }

  if (isImageFormat(source) && isPdfFormat(target)) {
    if (options.maxSizeBytes) {
      throw new ValidationError('Compressing to a target size is not supported when converting to PDF');
    }
    const buffer = await convertImagesToPdf([{ buffer: input, format: source }], options.resize);
    return { buffers: [{ buffer, suffix: '' }] };
  }

  if (isHeicFormat(source) && isImageFormat(target)) {
    const buffer = await convertHeic(input, target as ImageFormat, options);
    return { buffers: [{ buffer, suffix: '' }] };
  }

  if (isImageFormat(source) && isImageFormat(target)) {
    const buffer = await convertImage(input, target as ImageFormat, options);
    return { buffers: [{ buffer, suffix: '' }] };
  }

  throw new UnsupportedFormatError(`Conversion from "${source}" to "${target}" is not supported`);
}

export { convertImagesToPdf };
