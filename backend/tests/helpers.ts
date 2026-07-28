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

export async function makeSinglePagePdfBuffer(): Promise<Buffer> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawText('Chameleon test PDF');
  const bytes = await doc.save();
  return Buffer.from(bytes);
}
