import { Queue, Worker, type JobsOptions, type Processor } from 'bullmq';
import IORedis from 'ioredis';
import { z } from 'zod';

export const AUDIT_QUEUE_NAME = 'audit-runs';
export const RUN_SITE_AUDIT_JOB_NAME = 'run-site-audit';
export const AUDIT_QUEUE_ERROR_CODE = 'AUDIT_QUEUE_ERROR';
export const AUDIT_QUEUE_ERROR_MESSAGE =
  'The audit could not be queued. Please try again.';
export const AUDIT_PROCESSING_ERROR_CODE = 'AUDIT_PROCESSING_ERROR';
export const AUDIT_PROCESSING_ERROR_MESSAGE =
  'The audit could not be completed.';

export const auditJobPayloadSchema = z.object({
  auditRunId: z.uuid(),
  siteId: z.uuid(),
  workspaceId: z.uuid(),
});

export type AuditJobPayload = z.infer<typeof auditJobPayloadSchema>;

export const defaultAuditJobOptions: JobsOptions = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1_000,
  },
  removeOnComplete: 100,
  removeOnFail: 100,
};

export const createRedisConnection = (redisUrl: string) =>
  new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
  });

export const createAuditQueue = (redisUrl: string) => {
  const connection = createRedisConnection(redisUrl);

  return {
    connection,
    queue: new Queue<AuditJobPayload>(AUDIT_QUEUE_NAME, {
      connection,
      defaultJobOptions: defaultAuditJobOptions,
    }),
  };
};

export const createAuditWorker = (
  redisUrl: string,
  processor: Processor<AuditJobPayload>,
) => {
  const connection = createRedisConnection(redisUrl);

  return {
    connection,
    worker: new Worker<AuditJobPayload>(AUDIT_QUEUE_NAME, processor, {
      connection,
      concurrency: 1,
    }),
  };
};

export const getAuditJobId = (auditRunId: string) => auditRunId;
