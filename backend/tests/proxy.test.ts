import request from 'supertest';

jest.mock('../src/config/env', () => {
  const actual = jest.requireActual('../src/config/env');
  return { env: { ...actual.env, trustProxyHops: 1, rateLimitMax: 1 } };
});
jest.mock('../src/services/prisma', () => ({
  prisma: { $queryRaw: jest.fn().mockResolvedValue([{ '1': 1 }]) },
}));

import { createApp } from '../src/app';

const app = createApp();

describe('Deployment behind one trusted proxy', () => {
  it('limits each forwarded client independently', async () => {
    const first = await request(app).get('/api/missing').set('X-Forwarded-For', '192.0.2.1');
    const limited = await request(app).get('/api/missing').set('X-Forwarded-For', '192.0.2.1');
    const other = await request(app).get('/api/missing').set('X-Forwarded-For', '192.0.2.2');
    expect(first.status).toBe(404);
    expect(limited.status).toBe(429);
    expect(other.status).toBe(404);
  });

  it('keeps health checks available after the client request quota is exhausted', async () => {
    await request(app).get('/api/missing').set('X-Forwarded-For', '192.0.2.3');
    for (let i = 0; i < 3; i++) {
      const health = await request(app).get('/api/health').set('X-Forwarded-For', '192.0.2.3');
      expect(health.status).toBe(200);
      expect(health.body.dbConnected).toBe(true);
    }
  });

  it('lets the frontend read download filenames across origins', async () => {
    const response = await request(app).get('/api/health').set('Origin', 'http://localhost:3000');
    expect(response.headers['access-control-expose-headers']).toContain('Content-Disposition');
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });
});
