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
      .attach('files', jpg, { filename: 'b.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/zip');
  });

  it('rejects a batch with no files', async () => {
    const res = await request(app).post('/api/convert/batch').field('targetFormat', 'webp');
    expect(res.status).toBe(400);
  });
});
