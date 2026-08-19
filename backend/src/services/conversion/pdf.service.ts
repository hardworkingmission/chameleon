import { PDFDocument } from 'pdf-lib';
import { CorruptFileError } from '../../utils/errors';
import { ImageFormat } from '../../utils/formats';
import { convertImage, resizeImage, ImageConvertOptions, ResizeOptions } from './image.service';
import { cachedDynamicImport } from '../../utils/dynamicImport';

export interface PdfPageImage {
  page: number;
  buffer: Buffer;
}

/**
 * Renders each page of a PDF to an image buffer in the requested target format.
 */
export async function convertPdfToImages(
  input: Buffer,
  targetFormat: ImageFormat,
  options: ImageConvertOptions = {}
): Promise<PdfPageImage[]> {
  try {
    // pdf-to-img is ESM-only; import lazily so it works under CommonJS output.
    const { pdf } = await cachedDynamicImport('pdf-to-img');
    const document = await pdf(input, { scale: 2 });

    const needsReencode = targetFormat !== 'png' || !!options.resize || !!options.maxSizeBytes;
    const pages: PdfPageImage[] = [];
    let pageNumber = 1;
    for await (const pngBuffer of document) {
      const converted = needsReencode
        ? await convertImage(pngBuffer as Buffer, targetFormat, options)
        : (pngBuffer as Buffer);
      pages.push({ page: pageNumber, buffer: converted });
      pageNumber += 1;
    }

    if (pages.length === 0) throw new CorruptFileError('PDF has no renderable pages');
    return pages;
  } catch (err) {
    if (err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to process PDF — it may be corrupt or encrypted');
  }
}

/**
 * Combines one or more images into a single multi-page PDF, one image per page.
 */
export async function convertImagesToPdf(
  images: { buffer: Buffer; format: string }[],
  resize?: ResizeOptions
): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.create();

    for (const { buffer, format } of images) {
      const source = resize ? await resizeImage(buffer, resize) : buffer;
      // pdf-lib only embeds JPEG/PNG directly; re-encode anything else to PNG first.
      const normalized = format === 'jpg' || format === 'jpeg' ? 'jpg' : 'png';
      const imageBuffer = format === 'jpg' || format === 'jpeg' || format === 'png' ? source : await convertImage(source, 'png');

      const embedded =
        normalized === 'jpg' ? await pdfDoc.embedJpg(imageBuffer) : await pdfDoc.embedPng(imageBuffer);

      const page = pdfDoc.addPage([embedded.width, embedded.height]);
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height });
    }

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  } catch (err) {
    if (err instanceof CorruptFileError) throw err;
    throw new CorruptFileError('Unable to build PDF from the provided images');
  }
}
