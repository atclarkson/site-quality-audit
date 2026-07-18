import { getWorkerEnv } from '@site-quality-audit/config';
import { getPrismaClient } from '@site-quality-audit/database';
import { DATABASE_PROVIDER } from '@site-quality-audit/database/provider';
import { APP_NAME, WORKER_SERVICE_NAME } from '@site-quality-audit/domain';
import { createLogger } from '@site-quality-audit/logging';
import {
  createAuditWorker,
  type AuditJobPayload,
} from '@site-quality-audit/queue';
import { markAuditRunFailure, processAuditJob } from './audit-run-processor';

const env = getWorkerEnv();
const logger = createLogger({ service: WORKER_SERVICE_NAME });
const prisma = getPrismaClient();
const { connection, worker } = createAuditWorker(env.REDIS_URL, async (job) =>
  processAuditJob(job.data),
);
let isShuttingDown = false;

logger.info('worker.start', {
  app: APP_NAME,
  database: DATABASE_PROVIDER,
  nodeEnv: env.NODE_ENV,
  logLevel: env.LOG_LEVEL,
});

worker.on('failed', async (job, error) => {
  if (!job) {
    return;
  }

  const attempts = job.opts.attempts ?? 1;
  const isFinalAttempt = job.attemptsMade >= attempts;

  await markAuditRunFailure(job.data as AuditJobPayload, error, isFinalAttempt);
});

connection.on('error', (error) => {
  if (isShuttingDown && error.message === 'Connection is closed.') {
    return;
  }

  logger.error('worker.redis_error', {
    message: error.message,
  });
});

worker.on('error', (error) => {
  if (isShuttingDown && error.message === 'Connection is closed.') {
    return;
  }

  logger.error('worker.error', {
    message: error.message,
  });
});

const shutdown = async (signal: NodeJS.Signals) => {
  isShuttingDown = true;
  await worker.close();
  connection.disconnect();
  await prisma.$disconnect();
  logger.info('worker.stop', { signal });
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
