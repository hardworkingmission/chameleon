import request from 'supertest';
import { createApp } from '../src/app';
import { prisma } from '../src/services/prisma';

const app = createApp();

// These tests require a reachable MySQL database at process.env.DATABASE_URL
// (see tests/setup.ts and the README "Running tests" section).
const testEmail = `chameleon-test-${Date.now()}@example.com`;

describe('Auth flow', () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: testEmail } }).catch(() => undefined);
    await prisma.$disconnect();
  });

  it('registers a new user', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: testEmail, password: 'hunter2222' });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
  });

  it('rejects duplicate registration', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: testEmail, password: 'hunter2222' });
    expect(res.status).toBe(400);
  });

  it('logs in with correct credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'hunter2222' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'wrongpassword' });
    expect(res.status).toBe(401);
  });

  it('returns the current user for /me with a valid token', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: testEmail, password: 'hunter2222' });
    const token = login.body.token;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(testEmail);
  });
});
