import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  AuditRunStatus,
  CrawledPageDiscoverySource,
  CrawledPageFetchStatus,
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';
import {
  CRAWLED_PAGE_PAGE_SIZE,
  getAuditRunForWorkspace,
  getCrawledPageForAudit,
  listCrawledPagesForAudit,
} from './crawl-results';

const { DATABASE_URL } = parseDatabaseEnv({
  ...process.env,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID || 'test-google-id',
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET || 'test-google-secret',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret',
});
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });
const cleanupUserIds = new Set<string>();
const cleanupWorkspaceIds = new Set<string>();

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
  cleanupUserIds.add(user.id);
  cleanupWorkspaceIds.add(workspace.id);

  await db.membership.create({
    data: {
      role: MembershipRole.OWNER,
      userId: user.id,
      workspaceId: workspace.id,
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

afterEach(async () => {
  const workspaceIds = Array.from(cleanupWorkspaceIds);
  const userIds = Array.from(cleanupUserIds);

  cleanupWorkspaceIds.clear();
  cleanupUserIds.clear();

  if (workspaceIds.length > 0) {
    await db.workspace.deleteMany({
      where: {
        id: {
          in: workspaceIds,
        },
      },
    });
  }

  if (userIds.length > 0) {
    await db.user.deleteMany({
      where: {
        id: {
          in: userIds,
        },
      },
    });
  }
});

afterAll(async () => {
  await db.$disconnect();
});

describe('crawl results queries', () => {
  it('keeps audit detail and page records tenant-scoped', async () => {
    const ownerContext = await createAuthorizedContext('crawl-owner');
    const otherContext = await createAuthorizedContext('crawl-other');

    const site = await db.site.create({
      data: {
        workspaceId: ownerContext.workspace.id,
        name: 'Scoped Site',
        primaryUrl: 'https://scoped.example.com',
        normalizedPrimaryUrl: 'https://scoped.example.com',
      },
    });

    const auditRun = await db.auditRun.create({
      data: {
        siteId: site.id,
        status: AuditRunStatus.COMPLETED,
        workspaceId: ownerContext.workspace.id,
      },
    });

    const crawledPage = await db.crawledPage.create({
      data: {
        auditRunId: auditRun.id,
        crawlDepth: 0,
        discoverySource: CrawledPageDiscoverySource.PRIMARY,
        fetchStatus: CrawledPageFetchStatus.SUCCESS,
        normalizedUrl: 'https://scoped.example.com',
        redirectCount: 0,
        requestedUrl: 'https://scoped.example.com',
        siteId: site.id,
        title: 'Scoped',
        workspaceId: ownerContext.workspace.id,
      },
    });

    expect(
      await getAuditRunForWorkspace(ownerContext, site.id, auditRun.id, db),
    ).not.toBeNull();
    expect(
      await getCrawledPageForAudit(
        ownerContext,
        site.id,
        auditRun.id,
        crawledPage.id,
        db,
      ),
    ).not.toBeNull();

    await expect(
      getAuditRunForWorkspace(otherContext, site.id, auditRun.id, db),
    ).resolves.toBeNull();
    await expect(
      getCrawledPageForAudit(
        otherContext,
        site.id,
        auditRun.id,
        crawledPage.id,
        db,
      ),
    ).resolves.toBeNull();
    await expect(
      listCrawledPagesForAudit(otherContext, site.id, auditRun.id, {}, db),
    ).resolves.toMatchObject({
      page: 1,
      pageSize: CRAWLED_PAGE_PAGE_SIZE,
      pages: [],
      totalCount: 0,
      totalPages: 1,
    });
  });

  it('sorts and paginates page inventory server-side using safe sort keys', async () => {
    const context = await createAuthorizedContext('crawl-sort');

    const site = await db.site.create({
      data: {
        workspaceId: context.workspace.id,
        name: 'Sorted Site',
        primaryUrl: 'https://sorted.example.com',
        normalizedPrimaryUrl: 'https://sorted.example.com',
      },
    });

    const auditRun = await db.auditRun.create({
      data: {
        siteId: site.id,
        status: AuditRunStatus.COMPLETED,
        workspaceId: context.workspace.id,
      },
    });

    await db.crawledPage.createMany({
      data: [
        {
          auditRunId: auditRun.id,
          crawlDepth: 0,
          discoverySource: CrawledPageDiscoverySource.PRIMARY,
          fetchStatus: CrawledPageFetchStatus.SUCCESS,
          normalizedUrl: 'https://sorted.example.com/a',
          redirectCount: 0,
          requestedUrl: 'https://sorted.example.com/a',
          responseTimeMs: 30,
          siteId: site.id,
          statusCode: 200,
          visibleWordCount: 50,
          workspaceId: context.workspace.id,
        },
        {
          auditRunId: auditRun.id,
          crawlDepth: 0,
          discoverySource: CrawledPageDiscoverySource.LINK,
          fetchStatus: CrawledPageFetchStatus.SUCCESS,
          normalizedUrl: 'https://sorted.example.com/b',
          redirectCount: 0,
          requestedUrl: 'https://sorted.example.com/b',
          responseTimeMs: 10,
          siteId: site.id,
          statusCode: 404,
          visibleWordCount: 150,
          workspaceId: context.workspace.id,
        },
        {
          auditRunId: auditRun.id,
          crawlDepth: 0,
          discoverySource: CrawledPageDiscoverySource.LINK,
          fetchStatus: CrawledPageFetchStatus.SUCCESS,
          normalizedUrl: 'https://sorted.example.com/c',
          redirectCount: 0,
          requestedUrl: 'https://sorted.example.com/c',
          responseTimeMs: 20,
          siteId: site.id,
          statusCode: 301,
          visibleWordCount: 75,
          workspaceId: context.workspace.id,
        },
      ],
    });

    const sortedByWords = await listCrawledPagesForAudit(
      context,
      site.id,
      auditRun.id,
      {
        direction: 'desc',
        page: 1,
        pageSize: 2,
        sort: 'wordCount',
      },
      db,
    );

    expect(sortedByWords.totalCount).toBe(3);
    expect(sortedByWords.totalPages).toBe(2);
    expect(sortedByWords.pages.map((page) => page.normalizedUrl)).toEqual([
      'https://sorted.example.com/b',
      'https://sorted.example.com/c',
    ]);

    const sortedByStatus = await listCrawledPagesForAudit(
      context,
      site.id,
      auditRun.id,
      {
        direction: 'asc',
        page: 2,
        pageSize: 2,
        sort: 'status',
      },
      db,
    );

    expect(sortedByStatus.pages.map((page) => page.normalizedUrl)).toEqual([
      'https://sorted.example.com/b',
    ]);
  });
});
