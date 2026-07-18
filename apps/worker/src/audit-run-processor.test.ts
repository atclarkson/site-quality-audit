import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { parseDatabaseEnv, parseWorkerEnv } from '@site-quality-audit/config';
import {
  AuditRunStatus,
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import {
  RUN_SITE_AUDIT_JOB_NAME,
  createAuditQueue,
  createAuditWorker,
  getAuditJobId,
} from '@site-quality-audit/queue';
import { markAuditRunFailure, processAuditJob } from './audit-run-processor';

const { DATABASE_URL } = parseDatabaseEnv(process.env);
const { REDIS_URL } = parseWorkerEnv({
  ...process.env,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  REDIS_URL: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const queueResources: Array<{
  connection: { quit: () => Promise<unknown> };
  queue?: { close: () => Promise<void> };
  worker?: { close: () => Promise<void> };
}> = [];

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createAuditFixture = async () => {
  const user = await db.user.create({
    data: {
      email: `${unique('worker-user')}@example.com`,
      name: 'Worker User',
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: 'Worker Workspace',
      ownerUserId: user.id,
      slug: unique('worker-workspace'),
    },
  });

  await db.membership.create({
    data: {
      role: MembershipRole.OWNER,
      userId: user.id,
      workspaceId: workspace.id,
    },
  });

  const site = await db.site.create({
    data: {
      workspaceId: workspace.id,
      name: 'Worker Site',
      primaryUrl: `https://${unique('worker-site')}.example.com`,
      normalizedPrimaryUrl: `https://${unique('worker-site')}.example.com`,
    },
  });

  const auditRun = await db.auditRun.create({
    data: {
      requestedByUserId: user.id,
      siteId: site.id,
      status: AuditRunStatus.QUEUED,
      workspaceId: workspace.id,
    },
  });

  return {
    auditRun,
    site,
    user,
    workspace,
  };
};

const waitForAuditRunStatus = async (
  auditRunId: string,
  status: AuditRunStatus,
  timeoutMs = 10_000,
) => {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const auditRun = await db.auditRun.findUniqueOrThrow({
      where: { id: auditRunId },
    });

    if (auditRun.status === status) {
      return auditRun;
    }

    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  throw new Error(`Timed out waiting for ${status}`);
};

afterEach(async () => {
  while (queueResources.length > 0) {
    const resource = queueResources.pop();

    if (!resource) {
      continue;
    }

    if (resource.worker) {
      await resource.worker.close();
    }

    if (resource.queue) {
      await resource.queue.close();
    }

    await resource.connection.quit();
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe('audit worker', () => {
  it('processes a queued BullMQ audit job and persists completion state', async () => {
    const fixture = await createAuditFixture();
    const workerResources = createAuditWorker(REDIS_URL, async (job) =>
      processAuditJob(job.data, { delayMs: 25 }),
    );
    const queueResourcesEntry = createAuditQueue(REDIS_URL);
    queueResources.push(workerResources, queueResourcesEntry);

    try {
      await queueResourcesEntry.queue.add(
        RUN_SITE_AUDIT_JOB_NAME,
        {
          auditRunId: fixture.auditRun.id,
          siteId: fixture.site.id,
          workspaceId: fixture.workspace.id,
        },
        {
          jobId: getAuditJobId(fixture.auditRun.id),
        },
      );

      const completedAuditRun = await waitForAuditRunStatus(
        fixture.auditRun.id,
        AuditRunStatus.COMPLETED,
      );

      expect(completedAuditRun.startedAt).not.toBeNull();
      expect(completedAuditRun.completedAt).not.toBeNull();
    } finally {
      await db.workspace.delete({ where: { id: fixture.workspace.id } });
    }
  });

  it('persists a failed terminal state safely', async () => {
    const fixture = await createAuditFixture();

    try {
      await markAuditRunFailure(
        {
          auditRunId: fixture.auditRun.id,
          siteId: fixture.site.id,
          workspaceId: fixture.workspace.id,
        },
        new Error('Placeholder audit failed'),
        true,
      );

      const failedAuditRun = await db.auditRun.findUniqueOrThrow({
        where: { id: fixture.auditRun.id },
      });

      expect(failedAuditRun.status).toBe(AuditRunStatus.FAILED);
      expect(failedAuditRun.errorCode).toBe('AUDIT_PROCESSING_ERROR');
      expect(failedAuditRun.errorMessage).toBe('Placeholder audit failed');
    } finally {
      await db.workspace.delete({ where: { id: fixture.workspace.id } });
    }
  });
});
