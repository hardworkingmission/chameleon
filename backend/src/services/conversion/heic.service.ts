import { CorruptFileError } from '../../utils/errors';
import { ImageFormat } from '../../utils/formats';
import { convertImage, ImageConvertOptions } from './image.service';
import { dynamicImport } from '../../utils/dynamicImport';

export async function convertHeic(
  input: Buffer,
  targetFormat: ImageFormat,
  options: ImageConvertOptions = {}
): Promise<Buffer> {
  try {
    // heic-convert is ESM-only; import lazily so it works under CommonJS output.
    const heicConvert = (await dynamicImport('heic-convert')).default;
    const intermediateFormat = targetFormat === 'jpg' || targetFormat === 'jpeg' ? 'JPEG' : 'PNG';
    const jpegOrPngBuffer = (await heicConvert({
      buffer: input,
      format: intermediateFormat as 'JPEG' | 'PNG',
      quality: (options.quality ?? 85) / 100,
    })) as Buffer;

    const needsReencode = !(targetFormat === 'jpg' || targetFormat === 'jpeg' || targetFormat === 'png') || !!options.resize;
    if (!needsReencode) {
      return jpegOrPngBuffer;
    }

    // Re-encode via sharp when the target format differs or a resize was requested.
    return await convertImage(jpegOrPngBuffer, targetFormat, options);
  } catch (err) {
    if (err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to process HEIC/HEIF file — it may be corrupt or unsupported');
  }
}
