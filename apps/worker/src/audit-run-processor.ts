import { AuditRunStatus, getPrismaClient } from '@site-quality-audit/database';
import { WORKER_SERVICE_NAME } from '@site-quality-audit/domain';
import {
  auditJobPayloadSchema,
  type AuditJobPayload,
} from '@site-quality-audit/queue';
import { createLogger } from '@site-quality-audit/logging';

const logger = createLogger({ service: WORKER_SERVICE_NAME });

const sleep = (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const getFailureState = (error: unknown) => ({
  errorCode: 'AUDIT_PROCESSING_ERROR',
  errorMessage:
    error instanceof Error
      ? error.message.slice(0, 200)
      : 'Audit processing failed',
});

export const processAuditJob = async (
  input: AuditJobPayload,
  { delayMs = 1_500 }: { delayMs?: number } = {},
) => {
  const payload = auditJobPayloadSchema.parse(input);
  const prisma = getPrismaClient();

  const auditRun = await prisma.auditRun.findUnique({
    where: {
      id: payload.auditRunId,
    },
    select: {
      id: true,
      siteId: true,
      status: true,
      workspaceId: true,
    },
  });

  if (
    !auditRun ||
    auditRun.siteId !== payload.siteId ||
    auditRun.workspaceId !== payload.workspaceId
  ) {
    throw new Error('Audit run payload does not match persisted state');
  }

  if (auditRun.status === AuditRunStatus.COMPLETED) {
    return;
  }

  const now = new Date();

  await prisma.auditRun.update({
    where: {
      id: payload.auditRunId,
    },
    data: {
      status: AuditRunStatus.RUNNING,
      startedAt: auditRun.status === AuditRunStatus.RUNNING ? undefined : now,
      failedAt: null,
      errorCode: null,
      errorMessage: null,
    },
  });

  logger.info('audit.run_started', {
    auditRunId: payload.auditRunId,
    siteId: payload.siteId,
    workspaceId: payload.workspaceId,
  });

  await sleep(delayMs);

  await prisma.auditRun.update({
    where: {
      id: payload.auditRunId,
    },
    data: {
      status: AuditRunStatus.COMPLETED,
      completedAt: new Date(),
    },
  });

  logger.info('audit.run_completed', {
    auditRunId: payload.auditRunId,
    siteId: payload.siteId,
    workspaceId: payload.workspaceId,
  });
};

export const markAuditRunFailure = async (
  input: AuditJobPayload,
  error: unknown,
  isFinalAttempt: boolean,
) => {
  const payload = auditJobPayloadSchema.parse(input);
  const prisma = getPrismaClient();

  await prisma.auditRun.updateMany({
    where: {
      id: payload.auditRunId,
      siteId: payload.siteId,
      workspaceId: payload.workspaceId,
    },
    data: isFinalAttempt
      ? {
          status: AuditRunStatus.FAILED,
          failedAt: new Date(),
          ...getFailureState(error),
        }
      : {
          status: AuditRunStatus.QUEUED,
        },
  });

  logger.error('audit.run_failed', {
    auditRunId: payload.auditRunId,
    isFinalAttempt,
    siteId: payload.siteId,
    workspaceId: payload.workspaceId,
    ...getFailureState(error),
  });
};
