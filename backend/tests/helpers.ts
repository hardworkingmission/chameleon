import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';

export async function makePngBuffer(width = 64, height = 64, color = { r: 200, g: 100, b: 50 }): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

export async function makeJpegBuffer(width = 64, height = 64): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 10, g: 200, b: 30 } },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Random noise compresses poorly, so unlike a flat-color image its JPEG size
 * actually varies with quality — needed to exercise size-target compression.
 */
export async function makeNoisyJpegBuffer(width = 900, height = 700): Promise<Buffer> {
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let i = 0; i < raw.length; i++) {
    raw[i] = Math.floor(Math.random() * 256);
  }
  return sharp(raw, { raw: { width, height, channels } }).jpeg({ quality: 100 }).toBuffer();
}

export async function makeSinglePagePdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawText('Chameleon test PDF');
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
