import { Request, Response, NextFunction } from 'express';
import passport from '../auth/passport';
import { prisma } from '../services/prisma';
import { hashPassword } from '../auth/password';
import { signToken } from '../auth/jwt';
import { ValidationError, AuthError } from '../utils/errors';
import { env } from '../config/env';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setTokenCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export async function register(req: Request, res: Response, next: NextFunction) {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !EMAIL_RE.test(email)) throw new ValidationError('A valid email is required');
    if (!password || password.length < 8) throw new ValidationError('Password must be at least 8 characters');

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) throw new ValidationError('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), passwordHash, provider: 'LOCAL' },
    });

    const token = signToken({ userId: user.id, email: user.email });
    setTokenCookie(res, token);
    res.status(201).json({ token, user: { id: user.id, email: user.email } });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction) {
  passport.authenticate('local', { session: false }, (err: Error | null, user: Express.User | false, info: { message?: string }) => {
    if (err) return next(err);
    if (!user) return next(new AuthError(info?.message ?? 'Invalid email or password'));
    const u = user as { id: number; email: string };
    const token = signToken({ userId: u.id, email: u.email });
    setTokenCookie(res, token);
    res.json({ token, user: { id: u.id, email: u.email } });
  })(req, res, next);
}

export async function logout(_req: Request, res: Response) {
  res.clearCookie('token');
  res.status(204).send();
}

export async function me(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.auth) throw new AuthError();
    const user = await prisma.user.findUnique({ where: { id: req.auth.userId } });
    if (!user) throw new AuthError('User no longer exists');
    res.json({ id: user.id, email: user.email, provider: user.provider, createdAt: user.createdAt });
  } catch (err) {
    next(err);
  }
}
