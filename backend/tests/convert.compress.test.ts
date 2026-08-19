import request from 'supertest';
import sharp from 'sharp';
import { createApp } from '../src/app';
import { makeNoisyJpegBuffer, makePngBuffer } from './helpers';

const app = createApp();

describe('Size-target compression and metadata-only requests', () => {
  it('compresses an image to under the requested maxSizeKB', async () => {
    const jpeg = await makeNoisyJpegBuffer();
    expect(jpeg.length).toBeGreaterThan(50 * 1024);

    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'jpg')
      .field('maxSizeKB', '50')
      .attach('file', jpeg, { filename: 'input.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(50 * 1024);
    expect(res.headers['x-compression-target-met']).not.toBe('false');
  });

  it('compresses without a targetFormat, defaulting to a lossy format', async () => {
    const jpeg = await makeNoisyJpegBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('maxSizeKB', '100')
      .attach('file', jpeg, { filename: 'input.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.body.length).toBeLessThanOrEqual(100 * 1024);
  });

  it('rejects maxSizeKB for a non-lossy target format', async () => {
    const jpeg = await makeNoisyJpegBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'png')
      .field('maxSizeKB', '50')
      .attach('file', jpeg, { filename: 'input.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('ValidationError');
  });

  it('rejects an invalid maxSizeKB value', async () => {
    const jpeg = await makeNoisyJpegBuffer();
    const res = await request(app)
      .post('/api/convert')
      .field('targetFormat', 'jpg')
      .field('maxSizeKB', '-5')
      .attach('file', jpeg, { filename: 'input.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('strips metadata with stripMetadata=true and no other params', async () => {
    const png = await makePngBuffer();
    const withExif = await sharp(png).withMetadata({ exif: { IFD0: { Copyright: 'test' } } }).toBuffer();

    const res = await request(app)
      .post('/api/convert')
      .field('stripMetadata', 'true')
      .attach('file', withExif, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('image/png');
    const metadata = await sharp(res.body).metadata();
    expect(metadata.exif).toBeUndefined();
  });

  it('rejects a request with no targetFormat, resize, maxSizeKB, or stripMetadata', async () => {
    const png = await makePngBuffer();
    const res = await request(app)
      .post('/api/convert')
      .attach('file', png, { filename: 'input.png', contentType: 'image/png' });

    expect(res.status).toBe(400);
  });
});
