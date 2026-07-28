import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (Number.isNaN(parsed)) throw new Error(`Environment variable ${name} must be a number`);
  return parsed;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: num('PORT', 4000),
  databaseUrl: required('DATABASE_URL', 'mysql://root:root@localhost:3306/chameleon'),
  jwtSecret: required('JWT_SECRET', 'dev-secret-change-me'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',

  maxFileSizeMb: num('MAX_FILE_SIZE_MB', 25),
  maxBatchFiles: num('MAX_BATCH_FILES', 20),

  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? path.join(__dirname, '../../storage/uploads')),
  convertedDir: path.resolve(process.env.CONVERTED_DIR ?? path.join(__dirname, '../../storage/converted')),

  retentionMinutes: num('RETENTION_MINUTES', 60),
  cleanupIntervalMinutes: num('CLEANUP_INTERVAL_MINUTES', 15),

  rateLimitWindowMs: num('RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
  rateLimitMax: num('RATE_LIMIT_MAX', 100),

  enableGoogleOAuth: process.env.ENABLE_GOOGLE_OAUTH === 'true',
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,

  enableGithubOAuth: process.env.ENABLE_GITHUB_OAUTH === 'true',
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
};
