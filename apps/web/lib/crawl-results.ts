import {
  FindingSeverity,
  Prisma,
  getPrismaClient,
  type DatabaseClient,
} from '@site-quality-audit/database';
import type {
  FindingCategory,
  FindingCode,
} from '@site-quality-audit/findings';
import type { AuthorizedAppContext } from './authorized-app-context';

export const CRAWLED_PAGE_PAGE_SIZE = 50;

export const crawledPageSortOptions = {
  responseTime: 'responseTimeMs',
  status: 'statusCode',
  url: 'normalizedUrl',
  wordCount: 'visibleWordCount',
} as const;

const findingSeverityOrder: Record<FindingSeverity, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export type CrawledPageSortKey = keyof typeof crawledPageSortOptions;
export type SortDirection = 'asc' | 'desc';

const findingSelect = {
  id: true,
  code: true,
  category: true,
  severity: true,
  title: true,
  explanation: true,
  recommendedAction: true,
  evidenceJson: true,
  priorityScore: true,
  crawledPageId: true,
  crawledPage: {
    select: {
      id: true,
      isIndexable: true,
      normalizedUrl: true,
      title: true,
    },
  },
} satisfies Prisma.FindingSelect;

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
  robotsWarningCode: true,
  robotsWarningCount: true,
  robotsWarningMessage: true,
  sitemapCount: true,
  sitemapUrlCount: true,
  sitemapWarningCount: true,
  sitemapWarningCode: true,
  sitemapWarningMessage: true,
  crawlLimitReached: true,
  criticalFindingCount: true,
  highFindingCount: true,
  mediumFindingCount: true,
  lowFindingCount: true,
  infoFindingCount: true,
  pagesWithFindingsCount: true,
  findingsGeneratedAt: true,
} satisfies Prisma.AuditRunSelect;

type FindingRecord = Prisma.FindingGetPayload<{ select: typeof findingSelect }>;

export type AuditRunDetail = Prisma.AuditRunGetPayload<{
  select: typeof auditRunDetailSelect;
}>;

export type CrawledPageRecord = Prisma.CrawledPageGetPayload<{
  select: typeof crawledPageSelect;
}>;

export type FindingFilters = {
  category?: string;
  code?: string;
  indexableOnly?: boolean;
  search?: string;
  severity?: string;
};

export type TopPriorityPage = {
  crawledPageId: string;
  findingCount: number;
  highestSeverity: FindingSeverity;
  indexable: boolean;
  priorityScore: number;
  title: string | null;
  topFindingTitles: string[];
  url: string;
};

export type FindingGroup = {
  affectedPageCount: number;
  category: string;
  code: string;
  explanation: string;
  pages: Array<{
    crawledPageId: string;
    priorityScore: number;
    title: string | null;
    url: string;
  }>;
  recommendedAction: string;
  severity: FindingSeverity;
  title: string;
};

export type AuditReport = {
  appliedFilters: {
    category: string | null;
    code: string | null;
    indexableOnly: boolean;
    search: string;
    severity: string | null;
  };
  auditRun: AuditRunDetail;
  availableCategories: string[];
  availableCodes: string[];
  findingsByIssue: FindingGroup[];
  topPriorityPages: TopPriorityPage[];
};

export type CrawledPageDetail = CrawledPageRecord & {
  findings: Array<{
    category: string;
    code: string;
    explanation: string;
    priorityScore: number;
    recommendedAction: string;
    severity: FindingSeverity;
    title: string;
  }>;
  findingSummary: {
    findingCount: number;
    highestSeverity: FindingSeverity | null;
    priorityScore: number;
  };
};

const severityCompare = (left: FindingSeverity, right: FindingSeverity) =>
  findingSeverityOrder[right] - findingSeverityOrder[left];

const maxSeverity = (
  current: FindingSeverity | null,
  next: FindingSeverity,
): FindingSeverity => {
  if (!current) {
    return next;
  }

  return findingSeverityOrder[next] > findingSeverityOrder[current]
    ? next
    : current;
};

const getAffectedPageCountFromEvidence = (
  evidenceJson: Prisma.JsonValue | null,
): number => {
  if (
    !evidenceJson ||
    Array.isArray(evidenceJson) ||
    typeof evidenceJson !== 'object'
  ) {
    return 0;
  }

  const value = evidenceJson.affectedPageCount;
  return typeof value === 'number' ? value : 0;
};

const findingOrderBy = [
  { priorityScore: 'desc' },
  { severity: 'asc' },
  { code: 'asc' },
] satisfies Prisma.FindingOrderByWithRelationInput[];

const getAuditWhere = (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
) => ({
  id: auditRunId,
  siteId,
  workspaceId: context.workspace.id,
});

const buildFindingWhere = (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  filters: FindingFilters,
): Prisma.FindingWhereInput => {
  const search = filters.search?.trim() || undefined;

  return {
    auditRunId,
    siteId,
    workspaceId: context.workspace.id,
    ...(filters.category
      ? { category: filters.category as FindingCategory }
      : {}),
    ...(filters.code ? { code: filters.code as FindingCode } : {}),
    ...(filters.severity
      ? { severity: filters.severity as FindingSeverity }
      : {}),
    ...(filters.indexableOnly
      ? {
          OR: [{ crawledPageId: null }, { crawledPage: { isIndexable: true } }],
        }
      : {}),
    ...(search
      ? {
          OR: [
            { crawledPageId: null },
            {
              crawledPage: {
                OR: [
                  { normalizedUrl: { contains: search, mode: 'insensitive' } },
                  { title: { contains: search, mode: 'insensitive' } },
                ],
              },
            },
          ],
        }
      : {}),
  };
};

export const getAuditRunForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  prisma: DatabaseClient = getPrismaClient(),
) =>
  prisma.auditRun.findFirst({
    where: getAuditWhere(context, siteId, auditRunId),
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

export const getAuditReportForWorkspace = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  filters: FindingFilters = {},
  prisma: DatabaseClient = getPrismaClient(),
): Promise<AuditReport | null> => {
  const auditWhere = getAuditWhere(context, siteId, auditRunId);
  const findingWhere = buildFindingWhere(context, siteId, auditRunId, filters);

  const [auditRun, findings, availableFindings] = await Promise.all([
    prisma.auditRun.findFirst({
      where: auditWhere,
      select: auditRunDetailSelect,
    }),
    prisma.finding.findMany({
      where: findingWhere,
      select: findingSelect,
      orderBy: findingOrderBy,
    }),
    prisma.finding.findMany({
      where: {
        auditRunId,
        siteId,
        workspaceId: context.workspace.id,
      },
      select: {
        category: true,
        code: true,
      },
      distinct: ['category', 'code'],
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    }),
  ]);

  if (!auditRun) {
    return null;
  }

  const pageFindings = findings.filter(
    (finding): finding is FindingRecord & { crawledPageId: string } =>
      Boolean(finding.crawledPageId && finding.crawledPage),
  );
  const pageMap = new Map<string, TopPriorityPage>();

  for (const finding of pageFindings) {
    const existing = pageMap.get(finding.crawledPageId);

    pageMap.set(finding.crawledPageId, {
      crawledPageId: finding.crawledPageId,
      findingCount: (existing?.findingCount || 0) + 1,
      highestSeverity: maxSeverity(
        existing?.highestSeverity || null,
        finding.severity,
      ),
      indexable: finding.crawledPage!.isIndexable,
      priorityScore: Math.max(
        existing?.priorityScore || 0,
        finding.priorityScore,
      ),
      title: finding.crawledPage!.title,
      topFindingTitles: [
        ...(existing?.topFindingTitles || []),
        finding.title,
      ].slice(0, 3),
      url: finding.crawledPage!.normalizedUrl,
    });
  }

  const topPriorityPages = [...pageMap.values()]
    .sort((left, right) => {
      if (right.priorityScore !== left.priorityScore) {
        return right.priorityScore - left.priorityScore;
      }

      const severityDelta = severityCompare(
        left.highestSeverity,
        right.highestSeverity,
      );

      if (severityDelta !== 0) {
        return severityDelta;
      }

      return left.url.localeCompare(right.url);
    })
    .slice(0, 20);

  const findingGroups = new Map<string, FindingGroup>();

  for (const finding of findings) {
    const key = `${finding.code}:${finding.severity}`;
    const existing = findingGroups.get(key);

    if (!existing) {
      findingGroups.set(key, {
        affectedPageCount: 0,
        category: finding.category,
        code: finding.code,
        explanation: finding.explanation,
        pages: [],
        recommendedAction: finding.recommendedAction,
        severity: finding.severity,
        title: finding.title,
      });
    }

    if (finding.crawledPageId && finding.crawledPage) {
      const group = findingGroups.get(key)!;

      group.pages.push({
        crawledPageId: finding.crawledPageId,
        priorityScore: finding.priorityScore,
        title: finding.crawledPage.title,
        url: finding.crawledPage.normalizedUrl,
      });
    }
  }

  const findingsByIssue = [...findingGroups.values()]
    .map((group) => ({
      ...group,
      affectedPageCount:
        new Set(group.pages.map((page) => page.crawledPageId)).size ||
        getAffectedPageCountFromEvidence(
          findings.find(
            (finding) =>
              finding.code === group.code &&
              finding.severity === group.severity,
          )?.evidenceJson || null,
        ),
      pages: group.pages
        .sort((left, right) => {
          if (right.priorityScore !== left.priorityScore) {
            return right.priorityScore - left.priorityScore;
          }

          return left.url.localeCompare(right.url);
        })
        .slice(0, 20),
    }))
    .sort((left, right) => {
      const severityDelta = severityCompare(left.severity, right.severity);

      if (severityDelta !== 0) {
        return severityDelta;
      }

      if (right.affectedPageCount !== left.affectedPageCount) {
        return right.affectedPageCount - left.affectedPageCount;
      }

      return left.title.localeCompare(right.title);
    });

  return {
    appliedFilters: {
      category: filters.category || null,
      code: filters.code || null,
      indexableOnly: Boolean(filters.indexableOnly),
      search: filters.search?.trim() || '',
      severity: filters.severity || null,
    },
    auditRun,
    availableCategories: [
      ...new Set(availableFindings.map((item) => item.category)),
    ],
    availableCodes: [...new Set(availableFindings.map((item) => item.code))],
    findingsByIssue,
    topPriorityPages,
  };
};

export const getCrawledPageForAudit = async (
  context: AuthorizedAppContext,
  siteId: string,
  auditRunId: string,
  pageId: string,
  prisma: DatabaseClient = getPrismaClient(),
): Promise<CrawledPageDetail | null> => {
  const pageRecord = await prisma.crawledPage.findFirst({
    where: {
      auditRunId,
      id: pageId,
      siteId,
      workspaceId: context.workspace.id,
    },
    select: {
      ...crawledPageSelect,
      findings: {
        select: {
          category: true,
          code: true,
          explanation: true,
          priorityScore: true,
          recommendedAction: true,
          severity: true,
          title: true,
        },
        orderBy: findingOrderBy,
      },
    },
  });

  if (!pageRecord) {
    return null;
  }

  const highestSeverity = pageRecord.findings[0]?.severity || null;
  const priorityScore = pageRecord.findings.reduce(
    (max, finding) => Math.max(max, finding.priorityScore),
    0,
  );

  return {
    ...pageRecord,
    findingSummary: {
      findingCount: pageRecord.findings.length,
      highestSeverity,
      priorityScore,
    },
  };
};
