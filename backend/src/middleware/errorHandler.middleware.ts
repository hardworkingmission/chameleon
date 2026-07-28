import { Request, Response, NextFunction } from 'express';
import { MulterError } from 'multer';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: 'Not Found', message: `No route for ${req.method} ${req.path}` });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    if (err.statusCode >= 500) logger.error(err.message, { stack: err.stack });
    return res.status(err.statusCode).json({ error: err.name, message: err.message });
  }

  if (err instanceof MulterError) {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File exceeds maximum allowed size'
        : err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE'
        ? 'Too many files in this batch'
        : err.message;
    return res.status(400).json({ error: 'UploadError', message });
  }

  const error = err as Error;
  logger.error(error?.message ?? 'Unknown error', { stack: error?.stack });
  return res.status(500).json({ error: 'InternalServerError', message: 'Something went wrong' });
}
