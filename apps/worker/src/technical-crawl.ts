import { resolve4, resolve6 } from 'node:dns/promises';
import {
  CRAWL_ERROR_CODES,
  CRAWL_ERROR_MESSAGES,
  CRAWLER_USER_AGENT,
  DEFAULT_CRAWL_LIMITS,
  discoverSitemapUrls,
  extractHtmlPage,
  fetchCrawlResource,
  normalizeCrawlUrl,
  parseRobotsTxt,
  type CrawlLimits,
  type CrawlWarning,
  type DnsResolver,
  type FetchImpl,
  type ParsedRobotsTxt,
} from '@site-quality-audit/crawler';
import { generateFindingsForAudit } from '@site-quality-audit/findings';
import {
  AuditRunStatus,
  CrawledPageDiscoverySource,
  CrawledPageFetchStatus,
  Prisma,
  getPrismaClient,
} from '@site-quality-audit/database';
import { WORKER_SERVICE_NAME } from '@site-quality-audit/domain';
import { createLogger } from '@site-quality-audit/logging';

const logger = createLogger({ service: WORKER_SERVICE_NAME });

const HTML_ACCEPT_HEADER =
  'text/html,application/xhtml+xml;q=0.9,application/xml;q=0.7,text/xml;q=0.6,*/*;q=0.1';

type CrawlQueueItem = {
  depth: number;
  discoverySource: CrawledPageDiscoverySource;
  url: string;
};

type CrawlProgress = {
  crawledUrlCount: number;
  discoveredUrlCount: number;
  excludedUrlCount: number;
  failedUrlCount: number;
  queuedUrlCount: number;
};

type WorkerDeps = {
  dnsResolver?: DnsResolver;
  fetchImpl?: FetchImpl;
  limits?: CrawlLimits;
};

const defaultDnsResolver: DnsResolver = async (hostname) => {
  const [ipv4, ipv6] = await Promise.allSettled([
    resolve4(hostname),
    resolve6(hostname),
  ]);

  return [
    ...(ipv4.status === 'fulfilled' ? ipv4.value : []),
    ...(ipv6.status === 'fulfilled' ? ipv6.value : []),
  ];
};

const sleep = (durationMs: number) =>
  new Promise((resolve) => setTimeout(resolve, durationMs));

const isHtmlContentType = (contentType: string | null) =>
  Boolean(
    contentType &&
    (contentType.includes('text/html') ||
      contentType.includes('application/xhtml+xml')),
  );

const isPrimaryAuditFailure = (
  requestedUrl: string,
  primaryUrl: string,
  statusCode: number | null,
) =>
  normalizeCrawlUrl(requestedUrl).normalizedUrl === primaryUrl &&
  statusCode === null;

const pickWarning = (warnings: CrawlWarning[]) => warnings[0] || null;

const pageFindingPageSelect = {
  canonicalUrl: true,
  canonicalWarningCode: true,
  contentType: true,
  fetchStatus: true,
  finalUrl: true,
  firstH1: true,
  h1Count: true,
  h2Count: true,
  hasViewportMeta: true,
  htmlLang: true,
  id: true,
  imagesMissingAltCount: true,
  internalLinkCount: true,
  isIndexable: true,
  metaDescription: true,
  metaDescriptionLength: true,
  metaRobots: true,
  normalizedUrl: true,
  openGraphDescription: true,
  openGraphTitle: true,
  redirectCount: true,
  responseSizeBytes: true,
  responseTimeMs: true,
  statusCode: true,
  structuredDataCount: true,
  title: true,
  titleLength: true,
  visibleWordCount: true,
  xRobotsTag: true,
} satisfies Prisma.CrawledPageSelect;

const updateAuditProgress = async (
  auditRunId: string,
  progress: CrawlProgress,
  fields: Record<string, unknown> = {},
) =>
  getPrismaClient().auditRun.update({
    where: { id: auditRunId },
    data: {
      crawledUrlCount: progress.crawledUrlCount,
      discoveredUrlCount: progress.discoveredUrlCount,
      excludedUrlCount: progress.excludedUrlCount,
      failedUrlCount: progress.failedUrlCount,
      progressUpdatedAt: new Date(),
      queuedUrlCount: progress.queuedUrlCount,
      ...fields,
    },
  });

const persistAuditFindings = async ({
  auditRunId,
  crawlLimitReached,
  primaryUrl,
  robotsTxtExists,
  robotsTxtStatusCode,
  robotsWarningCode,
  robotsWarningMessage,
  sitemapCount,
  sitemapUrlCount,
  sitemapWarningCode,
  sitemapWarningMessage,
}: {
  auditRunId: string;
  crawlLimitReached: boolean;
  primaryUrl: string;
  robotsTxtExists: boolean | null;
  robotsTxtStatusCode: number | null;
  robotsWarningCode: string | null;
  robotsWarningMessage: string | null;
  sitemapCount: number;
  sitemapUrlCount: number;
  sitemapWarningCode: string | null;
  sitemapWarningMessage: string | null;
}) => {
  const prisma = getPrismaClient();
  const pages = await prisma.crawledPage.findMany({
    where: { auditRunId },
    orderBy: { normalizedUrl: 'asc' },
    select: pageFindingPageSelect,
  });

  const generated = generateFindingsForAudit({
    crawlLimitReached,
    crawledUrlCount: pages.filter((page) => page.fetchStatus !== 'FAILED')
      .length,
    excludedUrlCount: pages.filter((page) => page.fetchStatus === 'EXCLUDED')
      .length,
    failedUrlCount: pages.filter((page) => page.fetchStatus === 'FAILED')
      .length,
    pages,
    primaryUrl,
    queuedUrlCount: pages.filter((page) => page.fetchStatus !== 'EXCLUDED')
      .length,
    robotsTxtExists,
    robotsTxtStatusCode,
    robotsWarningCode,
    robotsWarningMessage,
    sitemapCount,
    sitemapUrlCount,
    sitemapWarningCode,
    sitemapWarningMessage,
  });

  await prisma.$transaction(async (tx) => {
    const auditRun = await tx.auditRun.findUniqueOrThrow({
      where: { id: auditRunId },
      select: {
        siteId: true,
        workspaceId: true,
      },
    });

    await tx.finding.deleteMany({
      where: { auditRunId },
    });

    if (generated.findings.length > 0) {
      await tx.finding.createMany({
        data: generated.findings.map(
          (finding): Prisma.FindingCreateManyInput => ({
            auditRunId,
            category: finding.category,
            code: finding.code,
            crawledPageId: finding.crawledPageId,
            evidenceJson: finding.evidenceJson ?? undefined,
            explanation: finding.explanation,
            priorityScore: finding.priorityScore,
            recommendedAction: finding.recommendedAction,
            severity: finding.severity,
            siteId: auditRun.siteId,
            title: finding.title,
            workspaceId: auditRun.workspaceId,
          }),
        ),
      });
    }

    await tx.auditRun.update({
      where: { id: auditRunId },
      data: {
        criticalFindingCount: generated.summary.criticalFindingCount,
        findingsGeneratedAt: new Date(),
        highFindingCount: generated.summary.highFindingCount,
        infoFindingCount: generated.summary.infoFindingCount,
        lowFindingCount: generated.summary.lowFindingCount,
        mediumFindingCount: generated.summary.mediumFindingCount,
        pagesWithFindingsCount: generated.summary.pagesWithFindingsCount,
      },
    });
  });
};

const upsertCrawledPage = async (
  auditRunId: string,
  data: {
    canonicalUrl?: string | null;
    canonicalWarningCode?: string | null;
    canonicalWarningMessage?: string | null;
    contentType?: string | null;
    crawlDepth: number;
    discoverySource: CrawledPageDiscoverySource;
    errorCode?: string | null;
    errorMessage?: string | null;
    externalLinkCount?: number;
    fetchedAt?: Date | null;
    finalUrl?: string | null;
    firstH1?: string | null;
    h1Count?: number;
    h2Count?: number;
    hasViewportMeta?: boolean;
    htmlLang?: string | null;
    imageCount?: number;
    imagesMissingAltCount?: number;
    internalLinkCount?: number;
    isIndexable?: boolean;
    metaDescription?: string | null;
    metaDescriptionLength?: number | null;
    metaRobots?: string | null;
    normalizedUrl: string;
    openGraphDescription?: string | null;
    openGraphTitle?: string | null;
    redirectCount: number;
    requestedUrl: string;
    responseSizeBytes?: number | null;
    responseTimeMs?: number | null;
    statusCode?: number | null;
    structuredDataCount?: number;
    title?: string | null;
    titleLength?: number | null;
    visibleWordCount?: number;
    workspaceId: string;
    siteId: string;
    xRobotsTag?: string | null;
    fetchStatus: CrawledPageFetchStatus;
  },
) =>
  getPrismaClient().crawledPage.upsert({
    where: {
      auditRunId_normalizedUrl: {
        auditRunId,
        normalizedUrl: data.normalizedUrl,
      },
    },
    create: {
      auditRunId,
      workspaceId: data.workspaceId,
      siteId: data.siteId,
      normalizedUrl: data.normalizedUrl,
      requestedUrl: data.requestedUrl,
      finalUrl: data.finalUrl || null,
      statusCode: data.statusCode ?? null,
      contentType: data.contentType ?? null,
      responseTimeMs: data.responseTimeMs ?? null,
      responseSizeBytes: data.responseSizeBytes ?? null,
      redirectCount: data.redirectCount,
      title: data.title ?? null,
      titleLength: data.titleLength ?? null,
      metaDescription: data.metaDescription ?? null,
      metaDescriptionLength: data.metaDescriptionLength ?? null,
      canonicalUrl: data.canonicalUrl ?? null,
      canonicalWarningCode: data.canonicalWarningCode ?? null,
      canonicalWarningMessage: data.canonicalWarningMessage ?? null,
      metaRobots: data.metaRobots ?? null,
      xRobotsTag: data.xRobotsTag ?? null,
      htmlLang: data.htmlLang ?? null,
      h1Count: data.h1Count ?? 0,
      firstH1: data.firstH1 ?? null,
      h2Count: data.h2Count ?? 0,
      visibleWordCount: data.visibleWordCount ?? 0,
      internalLinkCount: data.internalLinkCount ?? 0,
      externalLinkCount: data.externalLinkCount ?? 0,
      imageCount: data.imageCount ?? 0,
      imagesMissingAltCount: data.imagesMissingAltCount ?? 0,
      structuredDataCount: data.structuredDataCount ?? 0,
      openGraphTitle: data.openGraphTitle ?? null,
      openGraphDescription: data.openGraphDescription ?? null,
      hasViewportMeta: data.hasViewportMeta ?? false,
      isIndexable: data.isIndexable ?? true,
      crawlDepth: data.crawlDepth,
      discoverySource: data.discoverySource,
      fetchStatus: data.fetchStatus,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      fetchedAt: data.fetchedAt ?? null,
    },
    update: {
      requestedUrl: data.requestedUrl,
      finalUrl: data.finalUrl || null,
      statusCode: data.statusCode ?? null,
      contentType: data.contentType ?? null,
      responseTimeMs: data.responseTimeMs ?? null,
      responseSizeBytes: data.responseSizeBytes ?? null,
      redirectCount: data.redirectCount,
      title: data.title ?? null,
      titleLength: data.titleLength ?? null,
      metaDescription: data.metaDescription ?? null,
      metaDescriptionLength: data.metaDescriptionLength ?? null,
      canonicalUrl: data.canonicalUrl ?? null,
      canonicalWarningCode: data.canonicalWarningCode ?? null,
      canonicalWarningMessage: data.canonicalWarningMessage ?? null,
      metaRobots: data.metaRobots ?? null,
      xRobotsTag: data.xRobotsTag ?? null,
      htmlLang: data.htmlLang ?? null,
      h1Count: data.h1Count ?? 0,
      firstH1: data.firstH1 ?? null,
      h2Count: data.h2Count ?? 0,
      visibleWordCount: data.visibleWordCount ?? 0,
      internalLinkCount: data.internalLinkCount ?? 0,
      externalLinkCount: data.externalLinkCount ?? 0,
      imageCount: data.imageCount ?? 0,
      imagesMissingAltCount: data.imagesMissingAltCount ?? 0,
      structuredDataCount: data.structuredDataCount ?? 0,
      openGraphTitle: data.openGraphTitle ?? null,
      openGraphDescription: data.openGraphDescription ?? null,
      hasViewportMeta: data.hasViewportMeta ?? false,
      isIndexable: data.isIndexable ?? true,
      crawlDepth: data.crawlDepth,
      discoverySource: data.discoverySource,
      fetchStatus: data.fetchStatus,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      fetchedAt: data.fetchedAt ?? null,
    },
  });

export const runTechnicalCrawl = async (
  auditRunId: string,
  deps: WorkerDeps = {},
) => {
  const prisma = getPrismaClient();
  const dnsResolver = deps.dnsResolver || defaultDnsResolver;
  const fetchImpl = deps.fetchImpl || fetch;
  const limits = deps.limits || DEFAULT_CRAWL_LIMITS;

  const auditRun = await prisma.auditRun.findUnique({
    where: { id: auditRunId },
    select: {
      id: true,
      site: {
        select: {
          id: true,
          primaryUrl: true,
          sitemapUrl: true,
          workspaceId: true,
        },
      },
      status: true,
      workspaceId: true,
    },
  });

  if (!auditRun?.site || auditRun.workspaceId !== auditRun.site.workspaceId) {
    throw new Error('Audit run state is invalid.');
  }

  if (auditRun.status === AuditRunStatus.COMPLETED) {
    return;
  }

  const primaryUrl = normalizeCrawlUrl(auditRun.site.primaryUrl).normalizedUrl;
  const allowedHostname = normalizeCrawlUrl(primaryUrl).hostname;
  const robotsUrl = `${normalizeCrawlUrl(primaryUrl).url.origin}/robots.txt`;
  const progress: CrawlProgress = {
    crawledUrlCount: 0,
    discoveredUrlCount: 0,
    excludedUrlCount: 0,
    failedUrlCount: 0,
    queuedUrlCount: 0,
  };

  const discovered = new Set<string>();
  const queued = new Set<string>();
  const completed = new Set<string>();
  const queue: CrawlQueueItem[] = [];
  let nextRequestAt = 0;
  let crawlLimitReached = false;
  let robotsWarningCode: string | null = null;
  let robotsWarningMessage: string | null = null;
  let sitemapWarningCode: string | null = null;
  let sitemapWarningMessage: string | null = null;

  const waitForRequestTurn = async () => {
    const now = Date.now();
    const waitDuration = Math.max(0, nextRequestAt - now);
    nextRequestAt = Math.max(nextRequestAt, now) + limits.perHostDelayMs;
    if (waitDuration > 0) {
      await sleep(waitDuration);
    }
  };

  const enqueueUrl = async (
    rawUrl: string,
    discoverySource: CrawledPageDiscoverySource,
    depth: number,
    robots: ParsedRobotsTxt,
  ) => {
    if (depth > limits.maxDepth) {
      return;
    }

    let normalizedUrl: string;

    try {
      const normalized = normalizeCrawlUrl(rawUrl, primaryUrl);

      if (normalized.hostname !== allowedHostname) {
        return;
      }

      normalizedUrl = normalized.normalizedUrl;
    } catch {
      return;
    }

    if (discovered.has(normalizedUrl)) {
      return;
    }

    discovered.add(normalizedUrl);
    progress.discoveredUrlCount = discovered.size;

    if (!robots.isAllowed(normalizedUrl)) {
      progress.excludedUrlCount += 1;
      completed.add(normalizedUrl);
      await upsertCrawledPage(auditRunId, {
        crawlDepth: depth,
        discoverySource,
        errorCode: CRAWL_ERROR_CODES.robotsDisallowed,
        errorMessage: CRAWL_ERROR_MESSAGES[CRAWL_ERROR_CODES.robotsDisallowed],
        fetchStatus: CrawledPageFetchStatus.EXCLUDED,
        normalizedUrl,
        redirectCount: 0,
        requestedUrl: normalizedUrl,
        siteId: auditRun.site.id,
        workspaceId: auditRun.workspaceId,
      });
      return;
    }

    if (progress.queuedUrlCount >= limits.maxPages) {
      crawlLimitReached = true;
      return;
    }

    queue.push({
      depth,
      discoverySource,
      url: normalizedUrl,
    });
    queued.add(normalizedUrl);
    progress.queuedUrlCount = queued.size;
  };

  const robotsResponse = await fetchCrawlResource({
    accept: 'text/plain,*/*;q=0.1',
    allowedHostname,
    dnsResolver,
    fetchImpl,
    requestedUrl: robotsUrl,
  });

  const robots = parseRobotsTxt({
    content: robotsResponse.bodyText,
    fetchedAt: robotsResponse.fetchedAt,
    statusCode: robotsResponse.statusCode,
    userAgent: CRAWLER_USER_AGENT,
  });

  const sitemapDiscovery = await discoverSitemapUrls({
    allowedHostname,
    dnsResolver,
    fetchImpl,
    initialSitemapUrls: [
      ...(auditRun.site.sitemapUrl ? [auditRun.site.sitemapUrl] : []),
      ...robots.sitemaps,
      `${normalizeCrawlUrl(primaryUrl).url.origin}/sitemap.xml`,
    ],
  });

  const robotsWarning = pickWarning(robots.warnings);
  const sitemapWarning = pickWarning(sitemapDiscovery.warnings);

  robotsWarningCode = robotsWarning?.code || null;
  robotsWarningMessage = robotsWarning?.message || null;
  sitemapWarningCode = sitemapWarning?.code || null;
  sitemapWarningMessage = sitemapWarning?.message || null;

  await enqueueUrl(primaryUrl, CrawledPageDiscoverySource.PRIMARY, 0, robots);

  for (const sitemapUrl of sitemapDiscovery.pageUrls) {
    await enqueueUrl(sitemapUrl, CrawledPageDiscoverySource.SITEMAP, 1, robots);
  }

  await updateAuditProgress(auditRunId, progress, {
    robotsTxtExists: robots.exists,
    robotsTxtFetchedAt: robots.fetchedAt,
    robotsTxtStatusCode: robots.statusCode,
    robotsTxtUrl: robotsUrl,
    robotsWarningCode,
    robotsWarningCount: robots.warnings.length,
    robotsWarningMessage,
    crawlLimitReached,
    sitemapCount: sitemapDiscovery.sitemapCount,
    sitemapUrlCount: sitemapDiscovery.pageUrls.length,
    sitemapWarningCode,
    sitemapWarningCount: sitemapDiscovery.warnings.length,
    sitemapWarningMessage,
  });

  while (queue.length > 0 && progress.crawledUrlCount < limits.maxPages) {
    const batch = queue.splice(0, limits.concurrency);

    await Promise.all(
      batch.map(async (item) => {
        if (completed.has(item.url)) {
          return;
        }

        completed.add(item.url);
        await waitForRequestTurn();

        const response = await fetchCrawlResource({
          accept: HTML_ACCEPT_HEADER,
          allowedHostname,
          dnsResolver,
          fetchImpl,
          requestedUrl: item.url,
        });

        if (response.error) {
          progress.failedUrlCount += 1;

          await upsertCrawledPage(auditRunId, {
            crawlDepth: item.depth,
            discoverySource: item.discoverySource,
            errorCode: response.error.code,
            errorMessage: response.error.message,
            fetchStatus: CrawledPageFetchStatus.FAILED,
            fetchedAt: response.fetchedAt,
            finalUrl: response.finalUrl,
            normalizedUrl: response.finalUrl
              ? normalizeCrawlUrl(response.finalUrl).normalizedUrl
              : item.url,
            redirectCount: response.redirectChain.length,
            requestedUrl: item.url,
            responseTimeMs: response.responseTimeMs,
            siteId: auditRun.site.id,
            statusCode: response.statusCode,
            workspaceId: auditRun.workspaceId,
          });

          if (
            isPrimaryAuditFailure(item.url, primaryUrl, response.statusCode)
          ) {
            throw new Error('The primary site could not be reached.');
          }

          return;
        }

        const normalizedFinalUrl = normalizeCrawlUrl(
          response.finalUrl,
        ).normalizedUrl;
        discovered.add(normalizedFinalUrl);
        progress.discoveredUrlCount = discovered.size;

        if (!isHtmlContentType(response.headers.contentType)) {
          progress.crawledUrlCount += 1;

          await upsertCrawledPage(auditRunId, {
            contentType: response.headers.contentType,
            crawlDepth: item.depth,
            discoverySource: item.discoverySource,
            fetchStatus: CrawledPageFetchStatus.NON_HTML,
            fetchedAt: response.fetchedAt,
            finalUrl: normalizedFinalUrl,
            normalizedUrl: normalizedFinalUrl,
            redirectCount: response.redirectChain.length,
            requestedUrl: item.url,
            responseSizeBytes: response.responseSizeBytes,
            responseTimeMs: response.responseTimeMs,
            siteId: auditRun.site.id,
            statusCode: response.statusCode,
            workspaceId: auditRun.workspaceId,
            xRobotsTag: response.headers.xRobotsTag,
          });
          return;
        }

        const extracted = extractHtmlPage({
          baseUrl: normalizedFinalUrl,
          html: response.bodyText,
          scopeHostname: allowedHostname,
          xRobotsTag: response.headers.xRobotsTag,
        });
        const canonicalWarning = extracted.canonicalWarning;

        progress.crawledUrlCount += 1;

        await upsertCrawledPage(auditRunId, {
          canonicalUrl: extracted.canonicalUrl,
          canonicalWarningCode: canonicalWarning?.code || null,
          canonicalWarningMessage: canonicalWarning?.message || null,
          contentType: response.headers.contentType,
          crawlDepth: item.depth,
          discoverySource: item.discoverySource,
          externalLinkCount: extracted.externalLinkCount,
          fetchStatus: CrawledPageFetchStatus.SUCCESS,
          fetchedAt: response.fetchedAt,
          finalUrl: normalizedFinalUrl,
          firstH1: extracted.firstH1,
          h1Count: extracted.h1Count,
          h2Count: extracted.h2Count,
          hasViewportMeta: extracted.hasViewportMeta,
          htmlLang: extracted.htmlLang,
          imageCount: extracted.imageCount,
          imagesMissingAltCount: extracted.imagesMissingAltCount,
          internalLinkCount: extracted.internalLinkCount,
          isIndexable: extracted.isIndexable,
          metaDescription: extracted.metaDescription,
          metaDescriptionLength: extracted.metaDescriptionLength,
          metaRobots: extracted.metaRobots,
          normalizedUrl: normalizedFinalUrl,
          openGraphDescription: extracted.openGraphDescription,
          openGraphTitle: extracted.openGraphTitle,
          redirectCount: response.redirectChain.length,
          requestedUrl: item.url,
          responseSizeBytes: response.responseSizeBytes,
          responseTimeMs: response.responseTimeMs,
          siteId: auditRun.site.id,
          statusCode: response.statusCode,
          structuredDataCount: extracted.structuredDataCount,
          title: extracted.title,
          titleLength: extracted.titleLength,
          visibleWordCount: extracted.visibleWordCount,
          workspaceId: auditRun.workspaceId,
          xRobotsTag: response.headers.xRobotsTag,
        });

        for (const internalLink of extracted.internalLinks) {
          await enqueueUrl(
            internalLink,
            CrawledPageDiscoverySource.LINK,
            item.depth + 1,
            robots,
          );
        }
      }),
    );

    await updateAuditProgress(auditRunId, progress);
  }

  await persistAuditFindings({
    auditRunId,
    crawlLimitReached,
    primaryUrl,
    robotsTxtExists: robots.exists,
    robotsTxtStatusCode: robots.statusCode,
    robotsWarningCode,
    robotsWarningMessage,
    sitemapCount: sitemapDiscovery.sitemapCount,
    sitemapUrlCount: sitemapDiscovery.pageUrls.length,
    sitemapWarningCode,
    sitemapWarningMessage,
  });

  await prisma.auditRun.update({
    where: { id: auditRunId },
    data: {
      completedAt: new Date(),
      crawlLimitReached,
      crawledUrlCount: progress.crawledUrlCount,
      discoveredUrlCount: progress.discoveredUrlCount,
      excludedUrlCount: progress.excludedUrlCount,
      failedUrlCount: progress.failedUrlCount,
      progressUpdatedAt: new Date(),
      queuedUrlCount: progress.queuedUrlCount,
      robotsWarningCode,
      robotsWarningCount: robots.warnings.length,
      robotsWarningMessage,
      sitemapWarningCode,
      sitemapWarningCount: sitemapDiscovery.warnings.length,
      sitemapWarningMessage,
      status: AuditRunStatus.COMPLETED,
    },
  });

  logger.info('audit.run_completed', {
    auditRunId,
    crawledUrlCount: progress.crawledUrlCount,
    discoveredUrlCount: progress.discoveredUrlCount,
    excludedUrlCount: progress.excludedUrlCount,
    failedUrlCount: progress.failedUrlCount,
  });
};
