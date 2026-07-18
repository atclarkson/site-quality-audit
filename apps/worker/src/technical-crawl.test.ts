import { randomUUID } from 'node:crypto';
import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from 'node:http';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { parseDatabaseEnv } from '@site-quality-audit/config';
import {
  AuditRunStatus,
  CrawledPageFetchStatus,
  MembershipRole,
  createPrismaClient,
} from '@site-quality-audit/database';
import { runTechnicalCrawl } from './technical-crawl';

const { DATABASE_URL } = parseDatabaseEnv(process.env);
const db = createPrismaClient({ datasourceUrl: DATABASE_URL });

const FIXTURE_HOSTNAME = 'crawl-fixture.example.com';
const FIXTURE_PUBLIC_IP = '93.184.216.34';
const cleanupUserIds = new Set<string>();
const cleanupWorkspaceIds = new Set<string>();

const unique = (prefix: string) => `${prefix}-${randomUUID()}`;

const createAuditFixture = async () => {
  const user = await db.user.create({
    data: {
      email: `${unique('crawl-user')}@example.com`,
      name: 'Crawler User',
    },
  });

  const workspace = await db.workspace.create({
    data: {
      name: 'Crawler Workspace',
      ownerUserId: user.id,
      slug: unique('crawler-workspace'),
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

  const site = await db.site.create({
    data: {
      workspaceId: workspace.id,
      name: 'Fixture Site',
      primaryUrl: `https://${FIXTURE_HOSTNAME}`,
      normalizedPrimaryUrl: `https://${FIXTURE_HOSTNAME}`,
      sitemapUrl: `https://${FIXTURE_HOSTNAME}/sitemap.xml`,
    },
  });

  const auditRun = await db.auditRun.create({
    data: {
      requestedByUserId: user.id,
      siteId: site.id,
      status: AuditRunStatus.RUNNING,
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

const send = (
  response: ServerResponse,
  status: number,
  body: string,
  headers: Record<string, string> = {},
) => {
  response.writeHead(status, headers);
  response.end(body);
};

const fixtureRoutes = (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url || '/', `http://${FIXTURE_HOSTNAME}`);

  switch (url.pathname) {
    case '/robots.txt':
      return send(
        response,
        200,
        [
          'User-agent: *',
          'Disallow: /blocked',
          `Sitemap: https://${FIXTURE_HOSTNAME}/sitemap.xml`,
        ].join('\n'),
        { 'content-type': 'text/plain; charset=utf-8' },
      );
    case '/sitemap.xml':
      return send(
        response,
        200,
        [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          `<url><loc>https://${FIXTURE_HOSTNAME}/</loc></url>`,
          `<url><loc>https://${FIXTURE_HOSTNAME}/about</loc></url>`,
          `<url><loc>https://${FIXTURE_HOSTNAME}/feed.xml</loc></url>`,
          `<url><loc>https://${FIXTURE_HOSTNAME}/flaky</loc></url>`,
          `<url><loc>https://${FIXTURE_HOSTNAME}/blocked</loc></url>`,
          '</urlset>',
        ].join(''),
        { 'content-type': 'application/xml; charset=utf-8' },
      );
    case '/':
      return send(
        response,
        200,
        `
          <html lang="en">
            <head>
              <title>Fixture Home</title>
              <meta name="description" content="Fixture home page">
              <meta property="og:title" content="Fixture OG">
              <meta property="og:description" content="Fixture OG Description">
              <meta name="viewport" content="width=device-width,initial-scale=1">
              <link rel="canonical" href="/">
            </head>
            <body>
              <nav>Ignore these navigation words</nav>
              <h1>Fixture home</h1>
              <h2>Primary section</h2>
              <a href="/about#team">About</a>
              <a href="/about">About duplicate</a>
              <a href="/flaky">Flaky page</a>
              <a href="/blocked">Blocked page</a>
              <a href="https://external.example.org/">External page</a>
              <img src="/missing-alt.jpg">
              <img src="/with-alt.jpg" alt="Has alt">
              <script type="application/ld+json">{}</script>
              <script>ignored()</script>
              <p>Visible content on the fixture home page.</p>
            </body>
          </html>
        `,
        { 'content-type': 'text/html; charset=utf-8' },
      );
    case '/about':
      return send(
        response,
        200,
        `
          <html lang="en">
            <head>
              <title>About Fixture</title>
              <meta name="robots" content="noindex,follow">
            </head>
            <body>
              <h1>About us</h1>
              <a href="/team">Team</a>
              <p>About page content.</p>
            </body>
          </html>
        `,
        { 'content-type': 'text/html; charset=utf-8' },
      );
    case '/team':
      return send(
        response,
        200,
        `
          <html lang="en">
            <head>
              <title>Team Fixture</title>
              <link rel="canonical" href="https://user:pass@example.com">
            </head>
            <body>
              <h1>Team</h1>
              <p>Team page content.</p>
            </body>
          </html>
        `,
        { 'content-type': 'text/html; charset=utf-8' },
      );
    case '/feed.xml':
      return send(response, 200, '<feed></feed>', {
        'content-type': 'application/xml; charset=utf-8',
      });
    default:
      return send(response, 404, 'Not Found', {
        'content-type': 'text/plain; charset=utf-8',
      });
  }
};

const createFixtureServer = async () => {
  const server = createServer(fixtureRoutes);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new Error('Fixture server did not bind to a TCP port.');
  }

  return {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    origin: `http://127.0.0.1:${address.port}`,
  };
};

const createFixtureFetchImpl = (origin: string) => {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const requestedUrl =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(requestedUrl);

    if (url.hostname !== FIXTURE_HOSTNAME) {
      throw new Error(`Unexpected test hostname: ${url.hostname}`);
    }

    if (url.pathname === '/flaky') {
      throw new Error(
        'connect ECONNREFUSED redis://user:secret-pass@redis.example.com:6379',
      );
    }

    const localTarget = new URL(`${url.pathname}${url.search}`, origin);
    const localResponse = await fetch(localTarget, {
      headers: init?.headers,
      method: init?.method,
      redirect: init?.redirect,
      signal: init?.signal,
    });

    return new Response(await localResponse.arrayBuffer(), {
      headers: localResponse.headers,
      status: localResponse.status,
      statusText: localResponse.statusText,
    });
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

describe('runTechnicalCrawl', () => {
  it('completes a local fixture crawl, records safe failures, and keeps progress counts consistent', async () => {
    const server = await createFixtureServer();
    const fixture = await createAuditFixture();

    try {
      await runTechnicalCrawl(fixture.auditRun.id, {
        dnsResolver: async () => [FIXTURE_PUBLIC_IP],
        fetchImpl: createFixtureFetchImpl(server.origin),
        limits: {
          ...DEFAULT_TEST_LIMITS,
        },
      });

      const persistedAuditRun = await db.auditRun.findUniqueOrThrow({
        where: { id: fixture.auditRun.id },
      });
      const pages = await db.crawledPage.findMany({
        where: { auditRunId: fixture.auditRun.id },
        orderBy: { normalizedUrl: 'asc' },
      });

      expect(persistedAuditRun.status).toBe(AuditRunStatus.COMPLETED);
      expect(persistedAuditRun.completedAt).not.toBeNull();
      expect(persistedAuditRun.discoveredUrlCount).toBe(6);
      expect(persistedAuditRun.queuedUrlCount).toBe(5);
      expect(persistedAuditRun.crawledUrlCount).toBe(4);
      expect(persistedAuditRun.failedUrlCount).toBe(1);
      expect(persistedAuditRun.excludedUrlCount).toBe(1);
      expect(persistedAuditRun.discoveredUrlCount).toBe(
        persistedAuditRun.queuedUrlCount + persistedAuditRun.excludedUrlCount,
      );
      expect(persistedAuditRun.queuedUrlCount).toBe(
        persistedAuditRun.crawledUrlCount + persistedAuditRun.failedUrlCount,
      );
      expect(persistedAuditRun.robotsTxtStatusCode).toBe(200);
      expect(persistedAuditRun.robotsTxtExists).toBe(true);
      expect(persistedAuditRun.sitemapCount).toBe(1);
      expect(persistedAuditRun.sitemapUrlCount).toBe(5);

      expect(pages).toHaveLength(6);
      expect(
        pages.filter(
          (page) => page.fetchStatus === CrawledPageFetchStatus.SUCCESS,
        ),
      ).toHaveLength(3);
      expect(
        pages.filter(
          (page) => page.fetchStatus === CrawledPageFetchStatus.NON_HTML,
        ),
      ).toHaveLength(1);
      expect(
        pages.filter(
          (page) => page.fetchStatus === CrawledPageFetchStatus.FAILED,
        ),
      ).toHaveLength(1);
      expect(
        pages.filter(
          (page) => page.fetchStatus === CrawledPageFetchStatus.EXCLUDED,
        ),
      ).toHaveLength(1);

      const homePage = pages.find(
        (page) => page.normalizedUrl === `https://${FIXTURE_HOSTNAME}`,
      );
      expect(homePage).toMatchObject({
        fetchStatus: CrawledPageFetchStatus.SUCCESS,
        h1Count: 1,
        h2Count: 1,
        hasViewportMeta: true,
        imageCount: 2,
        imagesMissingAltCount: 1,
        internalLinkCount: 3,
        title: 'Fixture Home',
      });
      expect(homePage?.finalUrl).toBe(`https://${FIXTURE_HOSTNAME}`);

      const teamPage = pages.find(
        (page) => page.normalizedUrl === `https://${FIXTURE_HOSTNAME}/team`,
      );
      expect(teamPage?.canonicalWarningCode).toBe('MALFORMED_CANONICAL');

      const nonHtmlPage = pages.find(
        (page) => page.normalizedUrl === `https://${FIXTURE_HOSTNAME}/feed.xml`,
      );
      expect(nonHtmlPage).toMatchObject({
        contentType: 'application/xml; charset=utf-8',
        fetchStatus: CrawledPageFetchStatus.NON_HTML,
        title: null,
      });

      const failedPage = pages.find(
        (page) => page.normalizedUrl === `https://${FIXTURE_HOSTNAME}/flaky`,
      );
      expect(failedPage).toMatchObject({
        errorCode: 'CONNECTION_FAILED',
        errorMessage: 'The URL could not be reached.',
        fetchStatus: CrawledPageFetchStatus.FAILED,
      });
      expect(JSON.stringify(failedPage)).not.toContain('secret-pass');
      expect(JSON.stringify(failedPage)).not.toContain('redis.example.com');
    } finally {
      await server.close();
    }
  });

  it('uses upserts so retrying the same audit does not duplicate page rows', async () => {
    const server = await createFixtureServer();
    const fixture = await createAuditFixture();

    try {
      const deps = {
        dnsResolver: async () => [FIXTURE_PUBLIC_IP],
        fetchImpl: createFixtureFetchImpl(server.origin),
        limits: {
          ...DEFAULT_TEST_LIMITS,
        },
      };

      await runTechnicalCrawl(fixture.auditRun.id, deps);
      const firstCount = await db.crawledPage.count({
        where: { auditRunId: fixture.auditRun.id },
      });

      await db.auditRun.update({
        where: { id: fixture.auditRun.id },
        data: {
          completedAt: null,
          status: AuditRunStatus.RUNNING,
        },
      });

      await runTechnicalCrawl(fixture.auditRun.id, deps);

      expect(
        await db.crawledPage.count({
          where: { auditRunId: fixture.auditRun.id },
        }),
      ).toBe(firstCount);
    } finally {
      await server.close();
    }
  });
});

const DEFAULT_TEST_LIMITS = {
  concurrency: 2,
  maxDepth: 5,
  maxPages: 20,
  maxRedirects: 5,
  maxResponseBytes: 5 * 1024 * 1024,
  maxSitemapDepth: 2,
  maxSitemapDocuments: 10,
  maxSitemapUrls: 50,
  perHostDelayMs: 0,
  requestTimeoutMs: 250,
} as const;
