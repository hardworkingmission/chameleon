import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { makePngBuffer } from './helpers';

const app = createApp();

describe('POST /api/convert (image formats)', () => {
  it('converts a PNG to WebP', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'webp')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/webp');
  });

  it('converts a PNG to JPG with a quality setting', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'jpg')
      .field('quality', '50')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/jpeg');
  });

  it('resizes an image to the requested dimensions', async () => {
    const png = await makePngBuffer(200, 200);
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'png')
      .field('width', '80')
      .field('height', '80')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    const metadata = await sharp(res.body).metadata();
    expect(metadata.width).toBeLessThanOrEqual(80);
    expect(metadata.height).toBeLessThanOrEqual(80);
  });

  it('rejects a resize dimension above the maximum', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'png')
      .field('width', '999999')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported target format', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'exe')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(415);
    expect(res.body.error).toBe('UnsupportedFormatError');
  });

  it('rejects a corrupt/mislabeled file', async () => {
    const bogus = Buffer.from('this is not a real image file');
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'png')
      .attach('file', bogus, { filename: 'input.png', contentType: 'image/png' });

    expect([415, 422]).toContain(res.status);
  });

  it('rejects a request with no file', async () => {
    const res = await request(app).post('/api/convert').field('targetFormat', 'png');
    expect(res.status).toBe(400);
  });
});
