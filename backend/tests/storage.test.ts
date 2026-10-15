import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { env } from '../src/config/env';
import { createStorageGroup, storeFiles } from '../src/services/storage.service';

const send = jest.spyOn(S3Client.prototype, 'send');
const original = { driver: env.storageDriver, bucket: env.s3Bucket, region: env.s3Region };

beforeEach(() => {
  env.storageDriver = 's3';
  env.s3Bucket = 'test-bucket';
  env.s3Region = 'us-east-1';
  send.mockReset();
  send.mockResolvedValue({} as never);
});
afterAll(() => {
  env.storageDriver = original.driver;
  env.s3Bucket = original.bucket;
  env.s3Region = original.region;
  send.mockRestore();
});

it('stores private, non-expiring objects and keeps duplicate filenames distinct', async () => {
  const group = createStorageGroup();
  const file = { name: 'photo.png', buffer: Buffer.from('image'), contentType: 'image/png' };
  await storeFiles(group, 'originals', [file, file]);
  const commands = send.mock.calls.map(call => call[0] as PutObjectCommand);
  expect(commands[0].input).toEqual({ Bucket: 'test-bucket', Key: `${group}/originals/1-photo.png`,
    Body: file.buffer, ContentType: 'image/png' });
  expect(commands[1].input.Key).toBe(`${group}/originals/2-photo.png`);
  expect(createStorageGroup()).not.toBe(group);
});

it('does not call AWS in local mode', async () => {
  env.storageDriver = 'local';
  await storeFiles(createStorageGroup(), 'converted', [{ name: 'a.pdf', buffer: Buffer.from('pdf'), contentType: 'application/pdf' }]);
  expect(send).not.toHaveBeenCalled();
});

it('reports storage failure without exposing the AWS error', async () => {
  send.mockRejectedValueOnce(new Error('private AWS details') as never);
  await expect(storeFiles(createStorageGroup(), 'converted', [{ name: 'a.pdf', buffer: Buffer.from('pdf'), contentType: 'application/pdf' }]))
    .rejects.toMatchObject({ statusCode: 503, message: 'Unable to save files to storage. Please try again.' });
});
