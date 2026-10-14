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

const nodeEnv = process.env.NODE_ENV ?? 'development';
const jwtSecret = required('JWT_SECRET', 'dev-secret-change-me');
const placeholderSecrets = new Set([
  'dev-secret-change-me',
  'change-me-to-a-long-random-string',
  'REPLACE_WITH_AT_LEAST_32_RANDOM_CHARACTERS',
]);
if (nodeEnv === 'production' &&
    (jwtSecret.trim().length < 32 || placeholderSecrets.has(jwtSecret.trim()))) {
  throw new Error('Production JWT_SECRET must be a non-placeholder secret of at least 32 characters');
}

const trustProxyHops = num('TRUST_PROXY_HOPS', 0);
if (!Number.isSafeInteger(trustProxyHops) || trustProxyHops < 0) {
  throw new Error('TRUST_PROXY_HOPS must be a non-negative integer');
}

export const env = {
  nodeEnv,
  port: num('PORT', 4000),
  databaseUrl: required('DATABASE_URL', 'mysql://root:root@localhost:3306/chameleon'),
  jwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
  trustProxyHops,

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
