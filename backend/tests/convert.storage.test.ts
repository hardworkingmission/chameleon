import request from 'supertest';
import fs from 'fs/promises';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../src/config/env';
import { createApp } from '../src/app';
import { makePngBuffer } from './helpers';

const app = createApp();
const send = jest.spyOn(S3Client.prototype, 'send');
beforeEach(() => {
  env.storageDriver = 's3';
  env.s3Bucket = 'test-bucket';
  env.s3Region = 'us-east-1';
  send.mockReset();
  send.mockResolvedValue({} as never);
});
afterAll(() => { env.storageDriver = 'local'; send.mockRestore(); });
const objects = () => send.mock.calls.map(call => (call[0] as PutObjectCommand).input);

it('archives the original and converted bytes while returning the normal download', async () => {
  const png = await makePngBuffer();
  const res = await request(app).post('/api/convert').field('targetFormat', 'png')
    .attach('file', png, { filename: 'photo.png', contentType: 'image/png' });
  expect(res.status).toBe(200);
  expect(objects()).toHaveLength(2);
  expect(objects()[0].Body).toEqual(png);
  expect(objects()[0].Key).toContain('/originals/');
  expect(objects()[1].Key).toContain('/converted/');
  expect(objects()[1].Body).toEqual(res.body);
});

it('stores each batch conversion in a separate group', async () => {
  const png = await makePngBuffer();
  const res = await request(app).post('/api/convert/batch').field('targetFormat', 'webp')
    .attach('files', png, 'same.png').attach('files', png, 'same.png');
  expect(res.status).toBe(200);
  expect(res.headers['content-type']).toContain('application/zip');
  expect(objects()).toHaveLength(4);
  expect(new Set(objects().map(o => o.Key)).size).toBe(4);
});

it('stores all merge inputs and the resulting PDF', async () => {
  const png = await makePngBuffer();
  const res = await request(app).post('/api/convert/batch/merge-pdf').field('targetFormat', 'pdf')
    .attach('files', png, 'one.png').attach('files', png, 'two.png');
  expect(res.status).toBe(200);
  expect(objects()).toHaveLength(3);
  expect(objects()[2].ContentType).toBe('application/pdf');
  expect(objects()[2].Body).toEqual(res.body);
});

it('fails the request when output storage fails and still removes the temporary upload', async () => {
  const before = await fs.readdir(env.uploadDir);
  send.mockResolvedValueOnce({} as never).mockRejectedValueOnce(new Error('AccessDenied') as never);
  const res = await request(app).post('/api/convert').field('targetFormat', 'png')
    .attach('file', await makePngBuffer(), 'photo.png');
  expect(res.status).toBe(503);
  // Allow the handler finally block to finish after the response is sent.
  for (let i = 0; i < 20; i++) {
    if ((await fs.readdir(env.uploadDir)).length === before.length) break;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  expect((await fs.readdir(env.uploadDir)).sort()).toEqual(before.sort());
});

it('does not archive rejected files', async () => {
  const res = await request(app).post('/api/convert').field('targetFormat', 'png')
    .attach('file', Buffer.from('invalid'), 'bad.png');
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(send).not.toHaveBeenCalled();
});
