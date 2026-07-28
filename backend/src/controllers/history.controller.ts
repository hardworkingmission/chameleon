import { Request, Response, NextFunction } from 'express';
import { listHistory } from '../services/history.service';
import { AuthError } from '../utils/errors';

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new AuthError();
    const page = Number(req.query.page) || 1;
    const pageSize = Math.min(100, Number(req.query.pageSize) || 20);
    const result = await listHistory(req.auth.userId, page, pageSize);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
