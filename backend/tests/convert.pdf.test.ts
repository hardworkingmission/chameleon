import request from 'supertest';
import { createApp } from '../src/app';
import { makeSinglePagePdfBuffer, makePngBuffer } from './helpers';

const app = createApp();

describe('PDF conversions', () => {
  it('converts a single-page PDF to a PNG image', async () => {
    const pdf = await makeSinglePagePdfBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'png')
      .attach('file', pdf, { filename: 'input.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
  });

  it('converts an image to a PDF', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'pdf')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});
