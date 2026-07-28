import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

export const apiRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RateLimitExceeded', message: 'Too many requests, please try again later.' },
});

export const authRateLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'RateLimitExceeded', message: 'Too many auth attempts, please try again later.' },
});
