import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  AuditRunStatus,
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';
import { getAuditSnapshotForSite, startAuditForSite } from './audit-management';
import { createSiteForWorkspace } from './site-management';

const { DATABASE_URL } = parseDatabaseEnv({
  ...process.env,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || 'test-google-id',
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || 'test-google-secret',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createAuthorizedContext = async (
  emailPrefix: string,
): Promise<AuthorizedAppContext> => {
  const user = await db.user.create({
    data: {
      email: `${unique(emailPrefix)}@example.com`,
      name: `${emailPrefix} User`,
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: `${emailPrefix} Workspace`,
      ownerUserId: user.id,
      slug: unique(`${emailPrefix}-workspace`),
    },
  });

  await db.membership.create({
    data: {
      userId: user.id,
      workspaceId: workspace.id,
      role: MembershipRole.OWNER,
    },
  });

  return {
    role: MembershipRole.OWNER,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    workspace: {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
    },
  };
};

afterAll(async () => {
  await db.$disconnect();
});

describe('audit management', () => {
  it('creates a queued audit run and enqueues stable identifiers', async () => {
    const context = await createAuthorizedContext('audit-create');
    const enqueueAuditJobImpl = vi.fn().mockResolvedValue('job-1');

    try {
      const site = await createSiteForWorkspace(
        context,
        {
          name: 'Audit Site',
          primaryUrl: 'https://audit-create.example.com',
          sitemapUrl: '',
        },
        db,
      );

      const auditRun = await startAuditForSite(context, site.id, {
        enqueueAuditJobImpl,
        prisma: db,
      });

      expect(auditRun).toMatchObject({
        queueJobId: 'job-1',
        status: AuditRunStatus.QUEUED,
      });
      expect(enqueueAuditJobImpl).toHaveBeenCalledWith({
        auditRunId: auditRun?.id,
        siteId: site.id,
        workspaceId: context.workspace.id,
      });
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });

  it('returns the existing active audit instead of creating a duplicate', async () => {
    const context = await createAuthorizedContext('audit-duplicate');
    const enqueueAuditJobImpl = vi.fn().mockResolvedValue('job-2');

    try {
      const site = await createSiteForWorkspace(
        context,
        {
          name: 'Duplicate Audit Site',
          primaryUrl: 'https://audit-duplicate.example.com',
          sitemapUrl: '',
        },
        db,
      );

      const firstAuditRun = await startAuditForSite(context, site.id, {
        enqueueAuditJobImpl,
        prisma: db,
      });
      const secondAuditRun = await startAuditForSite(context, site.id, {
        enqueueAuditJobImpl,
        prisma: db,
      });

      expect(secondAuditRun?.id).toBe(firstAuditRun?.id);
      expect(
        await db.auditRun.count({
          where: {
            siteId: site.id,
            workspaceId: context.workspace.id,
          },
        }),
      ).toBe(1);
      expect(enqueueAuditJobImpl).toHaveBeenCalledTimes(1);
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });

  it('does not let one workspace start or inspect another workspace audit', async () => {
    const ownerContext = await createAuthorizedContext('audit-owner');
    const otherContext = await createAuthorizedContext('audit-other');
    const enqueueAuditJobImpl = vi.fn().mockResolvedValue('job-3');

    try {
      const site = await createSiteForWorkspace(
        ownerContext,
        {
          name: 'Owner Audit Site',
          primaryUrl: 'https://audit-owner.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        startAuditForSite(otherContext, site.id, {
          enqueueAuditJobImpl,
          prisma: db,
        }),
      ).resolves.toBeNull();

      await expect(
        getAuditSnapshotForSite(otherContext, site.id, db),
      ).resolves.toBeNull();
      expect(enqueueAuditJobImpl).not.toHaveBeenCalled();
    } finally {
      await db.workspace.deleteMany({
        where: {
          id: {
            in: [ownerContext.workspace.id, otherContext.workspace.id],
          },
        },
      });
    }
  });

  it('marks the audit run failed if enqueueing raises an unexpected error', async () => {
    const context = await createAuthorizedContext('audit-failure');

    try {
      const site = await createSiteForWorkspace(
        context,
        {
          name: 'Failed Audit Site',
          primaryUrl: 'https://audit-failure.example.com',
          sitemapUrl: '',
        },
        db,
      );

      await expect(
        startAuditForSite(context, site.id, {
          enqueueAuditJobImpl: vi
            .fn()
            .mockRejectedValue(new Error('Redis unavailable')),
          prisma: db,
        }),
      ).rejects.toThrow('Redis unavailable');

      const auditRun = await db.auditRun.findFirstOrThrow({
        where: {
          siteId: site.id,
          workspaceId: context.workspace.id,
        },
      });

      expect(auditRun.status).toBe(AuditRunStatus.FAILED);
      expect(auditRun.errorCode).toBe('AUDIT_QUEUE_ERROR');
      expect(auditRun.errorMessage).toBe('Redis unavailable');
    } finally {
      await db.workspace.delete({ where: { id: context.workspace.id } });
    }
  });
});
