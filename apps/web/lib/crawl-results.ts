import {
  Prisma,
  getPrismaClient,
  type DatabaseClient,
} from '@site-quality-audit/database';
import type { AuthorizedAppContext } from './authorized-app-context';

export const CRAWLED_PAGE_PAGE_SIZE = 50;

export const crawledPageSortOptions = {
  responseTime: 'responseTimeMs',
  status: 'statusCode',
  url: 'normalizedUrl',
  wordCount: 'visibleWordCount',
} as const;

export type CrawledPageSortKey = keyof typeof crawledPageSortOptions;
export type SortDirection = 'asc' | 'desc';

const crawledPageSelect = {
  id: true,
  normalizedUrl: true,
  requestedUrl: true,
  finalUrl: true,
  statusCode: true,
  contentType: true,
  responseTimeMs: true,
  responseSizeBytes: true,
  redirectCount: true,
  title: true,
  titleLength: true,
  metaDescription: true,
  metaDescriptionLength: true,
  canonicalUrl: true,
  canonicalWarningCode: true,
  canonicalWarningMessage: true,
  metaRobots: true,
  xRobotsTag: true,
  htmlLang: true,
  h1Count: true,
  firstH1: true,
  h2Count: true,
  visibleWordCount: true,
  internalLinkCount: true,
  externalLinkCount: true,
  imageCount: true,
  imagesMissingAltCount: true,
  structuredDataCount: true,
  openGraphTitle: true,
  openGraphDescription: true,
  hasViewportMeta: true,
  isIndexable: true,
  crawlDepth: true,
  discoverySource: true,
  fetchStatus: true,
  errorCode: true,
  errorMessage: true,
  fetchedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CrawledPageSelect;

const auditRunDetailSelect = {
  id: true,
  status: true,
  startedAt: true,
  completedAt: true,
  failedAt: true,
  errorCode: true,
  errorMessage: true,
  createdAt: true,
  updatedAt: true,
  discoveredUrlCount: true,
  queuedUrlCount: true,
  crawledUrlCount: true,
  failedUrlCount: true,
  excludedUrlCount: true,
  progressUpdatedAt: true,
  robotsTxtUrl: true,
  robotsTxtStatusCode: true,
  robotsTxtFetchedAt: true,
  robotsTxtExists: true,
  sitemapCount: true,
  sitemapUrlCount: true,
  sitemapWarningCount: true,
  sitemapWarningMessage: true,
} satisfies Prisma.AuditRunSelect;

export type AuditRunDetail = Prisma.AuditRunGetPayload<{
  select: typeof auditRunDetailSelect;
}>;

export type CrawledPageRecord = Prisma.CrawledPageGetPayload<{
  select: typeof crawledPageSelect;
}>;

export const getAuditRunForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  prisma: DatabaseClient = getPrismaClient(),
) =>
  prisma.auditRun.findFirst({
    where: {
      id: auditRunId,
      siteId,
      workspaceId: context.workspace.id,
    },
    select: auditRunDetailSelect,
  });

export const listCrawledPagesForAudit = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  {
    direction = 'asc',
    page = 1,
    pageSize = CRAWLED_PAGE_PAGE_SIZE,
    sort = 'url',
  }: {
    direction?: SortDirection;
    page?: number;
    pageSize?: number;
    sort?: CrawledPageSortKey;
  } = {},
  prisma: DatabaseClient = getPrismaClient(),
) => {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1;
  const safePageSize =
    Number.isFinite(pageSize) && pageSize > 0
      ? Math.floor(pageSize)
      : CRAWLED_PAGE_PAGE_SIZE;
  const safeDirection: SortDirection = direction === 'desc' ? 'desc' : 'asc';
  const orderField = crawledPageSortOptions[sort] || crawledPageSortOptions.url;
  const orderBy: Prisma.CrawledPageOrderByWithRelationInput[] = [
    { [orderField]: safeDirection },
    { normalizedUrl: 'asc' },
  ];

  const where = {
    auditRunId,
    siteId,
    workspaceId: context.workspace.id,
  };

  const [pages, totalCount] = await Promise.all([
    prisma.crawledPage.findMany({
      where,
      orderBy,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
      select: crawledPageSelect,
    }),
    prisma.crawledPage.count({ where }),
  ]);

  return {
    page: safePage,
    pageSize: safePageSize,
    pages,
    totalCount,
    totalPages: Math.max(1, Math.ceil(totalCount / safePageSize)),
  };
};

export const getCrawledPageForAudit = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  pageId: string,
  prisma: DatabaseClient = getPrismaClient(),
) =>
  prisma.crawledPage.findFirst({
    where: {
      auditRunId,
      id: pageId,
      siteId,
      workspaceId: context.workspace.id,
    },
    select: crawledPageSelect,
  });
