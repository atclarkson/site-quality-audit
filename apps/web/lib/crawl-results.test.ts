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
  getAuditReportForWorkspace,
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

  it('returns tenant-scoped prioritized findings ordered by priority and severity', async () => {
    const ownerContext = await createAuthorizedContext('findings-owner');
    const otherContext = await createAuthorizedContext('findings-other');

    const site = await db.site.create({
      data: {
        workspaceId: ownerContext.workspace.id,
        name: 'Report Site',
        primaryUrl: 'https://report.example.com',
        normalizedPrimaryUrl: 'https://report.example.com',
      },
    });

    const auditRun = await db.auditRun.create({
      data: {
        status: AuditRunStatus.COMPLETED,
        workspaceId: ownerContext.workspace.id,
        siteId: site.id,
        criticalFindingCount: 1,
        highFindingCount: 2,
        mediumFindingCount: 0,
        lowFindingCount: 0,
        infoFindingCount: 0,
        pagesWithFindingsCount: 2,
      },
    });

    const pageA = await db.crawledPage.create({
      data: {
        auditRunId: auditRun.id,
        crawlDepth: 0,
        discoverySource: CrawledPageDiscoverySource.PRIMARY,
        fetchStatus: CrawledPageFetchStatus.SUCCESS,
        isIndexable: true,
        normalizedUrl: 'https://report.example.com/a',
        redirectCount: 0,
        requestedUrl: 'https://report.example.com/a',
        siteId: site.id,
        title: 'Page A',
        workspaceId: ownerContext.workspace.id,
      },
    });

    const pageB = await db.crawledPage.create({
      data: {
        auditRunId: auditRun.id,
        crawlDepth: 0,
        discoverySource: CrawledPageDiscoverySource.LINK,
        fetchStatus: CrawledPageFetchStatus.SUCCESS,
        isIndexable: false,
        normalizedUrl: 'https://report.example.com/b',
        redirectCount: 0,
        requestedUrl: 'https://report.example.com/b',
        siteId: site.id,
        title: 'Page B',
        workspaceId: ownerContext.workspace.id,
      },
    });

    await db.finding.createMany({
      data: [
        {
          auditRunId: auditRun.id,
          category: 'CRAWL',
          code: 'FETCH_FAILED',
          crawledPageId: pageA.id,
          explanation: 'Explanation',
          priorityScore: 100,
          recommendedAction: 'Action',
          severity: 'CRITICAL',
          siteId: site.id,
          title: 'Page fetch failed',
          workspaceId: ownerContext.workspace.id,
        },
        {
          auditRunId: auditRun.id,
          category: 'METADATA',
          code: 'TITLE_MISSING',
          crawledPageId: pageA.id,
          explanation: 'Explanation',
          priorityScore: 100,
          recommendedAction: 'Action',
          severity: 'HIGH',
          siteId: site.id,
          title: 'Title missing',
          workspaceId: ownerContext.workspace.id,
        },
        {
          auditRunId: auditRun.id,
          category: 'INDEXABILITY',
          code: 'NOINDEX_PAGE',
          crawledPageId: pageB.id,
          explanation: 'Explanation',
          priorityScore: 70,
          recommendedAction: 'Action',
          severity: 'HIGH',
          siteId: site.id,
          title: 'Page marked noindex',
          workspaceId: ownerContext.workspace.id,
        },
      ],
    });

    const ownerReport = await getAuditReportForWorkspace(
      ownerContext,
      site.id,
      auditRun.id,
      {},
      db,
    );

    expect(ownerReport?.topPriorityPages.map((page) => page.url)).toEqual([
      'https://report.example.com/a',
      'https://report.example.com/b',
    ]);
    expect(ownerReport?.findingsByIssue[0]).toMatchObject({
      affectedPageCount: 1,
      code: 'FETCH_FAILED',
      severity: 'CRITICAL',
    });

    const filteredReport = await getAuditReportForWorkspace(
      ownerContext,
      site.id,
      auditRun.id,
      {
        indexableOnly: true,
        severity: 'HIGH',
      },
      db,
    );

    expect(filteredReport?.topPriorityPages).toHaveLength(1);
    expect(filteredReport?.topPriorityPages[0]?.url).toBe(
      'https://report.example.com/a',
    );

    await expect(
      getAuditReportForWorkspace(otherContext, site.id, auditRun.id, {}, db),
    ).resolves.toBeNull();
  });
});
