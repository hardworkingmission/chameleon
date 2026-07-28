import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { getHistory } from '../controllers/history.controller';

const router = Router();

router.get('/', requireAuth, getHistory);

export default router;
