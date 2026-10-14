import request from 'supertest';
import { createApp } from '../src/app';
import { makePngBuffer, makeJpegBuffer } from './helpers';

const app = createApp();

describe('POST /api/convert/batch', () => {
  it('converts multiple images and returns a zip', async () => {
    const png = await makePngBuffer();
    const jpg = await makeJpegBuffer();

    const res = await request(app)
      .post('/api/convert/batch')
      .field('targetFormat', 'webp')
      .attach('files', png, { filename: 'a.png', contentType: 'image/png' })
      .attach('files', jpg, { filename: 'b.jpg', contentType: 'image/jpeg' })
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk: Buffer) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
        response.on('error', callback);
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
    // ZIP entry names are uncompressed. A 200 response can also contain only
    // errors.json, so verify that both requested conversions actually succeeded.
    expect(res.body.includes(Buffer.from('a.webp'))).toBe(true);
    expect(res.body.includes(Buffer.from('b.webp'))).toBe(true);
    expect(res.body.includes(Buffer.from('errors.json'))).toBe(false);
  });

  it('rejects a batch with no files', async () => {
    const res = await request(app).post('/api/convert/batch').field('targetFormat', 'webp');
    expect(res.status).toBe(400);
  });
});
