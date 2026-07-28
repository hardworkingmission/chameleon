import { createApp } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { scheduleCleanup } from './services/cleanup.service';

const app = createApp();

app.listen(env.port, () => {
  logger.info(`Chameleon backend listening on port ${env.port} (${env.nodeEnv})`);
  scheduleCleanup();
});
