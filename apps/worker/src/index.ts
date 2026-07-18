import { getWorkerEnv } from '@site-quality-audit/config';
import { DATABASE_PROVIDER } from '@site-quality-audit/database/provider';
import { APP_NAME, WORKER_SERVICE_NAME } from '@site-quality-audit/domain';
import { createLogger } from '@site-quality-audit/logging';

const env = getWorkerEnv();
const logger = createLogger({ service: WORKER_SERVICE_NAME });

logger.info('worker.start', {
  app: APP_NAME,
  database: DATABASE_PROVIDER,
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
});

const keepAliveTimer = setInterval(() => undefined, 60_000);

const shutdown = (signal: NodeJS.Signals) => {
  clearInterval(keepAliveTimer);
  logger.info('worker.stop', { signal });
  process.exit(0);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
