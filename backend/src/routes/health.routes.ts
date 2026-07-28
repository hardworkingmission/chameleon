import { Router } from 'express';
import { prisma } from '../services/prisma';

const router = Router();

router.get('/', async (_req, res) => {
  let dbConnected = true;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    dbConnected = false;
  }

  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? 'ok' : 'degraded',
    uptimeSeconds: process.uptime(),
    dbConnected,
    timestamp: new Date().toISOString(),
  });
});

export default router;
