import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../auth/jwt';
import { AuthError } from '../utils/errors';

function extractToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.token) return req.cookies.token;
  return undefined;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return next(new AuthError('Authentication required'));
  try {
    req.auth = verifyToken(token);
    next();
  } catch {
    next(new AuthError('Invalid or expired token'));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (token) {
    try {
      req.auth = verifyToken(token);
    } catch {
      // ignore invalid token for optional auth; treat as anonymous
    }
  }
  next();
}
