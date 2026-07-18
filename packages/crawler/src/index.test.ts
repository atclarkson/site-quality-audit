import { describe, expect, it, vi } from 'vitest';
import {
  CRAWL_ERROR_CODES,
  CRAWL_WARNING_CODES,
  assertPublicHttpUrl,
  discoverSitemapUrls,
  extractHtmlPage,
  fetchCrawlResource,
  normalizeCrawlUrl,
  parseRobotsTxt,
  parseSitemapXml,
} from './index';

const publicDnsResolver = vi.fn(async () => ['93.184.216.34']);

describe('crawler URL handling', () => {
  it('normalizes equivalent URLs and removes fragments', () => {
    const variants = [
      'https://Example.com',
      'https://example.com/',
      'https://example.com/#section',
      'https://example.com:443',
    ];

    expect(
      new Set(variants.map((value) => normalizeCrawlUrl(value).normalizedUrl)),
    ).toEqual(new Set(['https://example.com']));
  });

  it('rejects unsupported schemes and embedded credentials', () => {
    expect(() => normalizeCrawlUrl('mailto:test@example.com')).toThrow(
      CRAWL_ERROR_CODES.invalidUrl,
    );
    expect(() => normalizeCrawlUrl('https://user:pass@example.com')).toThrow(
      CRAWL_ERROR_CODES.invalidUrl,
    );
  });

  it('rejects localhost, private literal IPs, and private DNS results', async () => {
    await expect(
      assertPublicHttpUrl('http://localhost:3000', publicDnsResolver),
    ).rejects.toMatchObject({ code: CRAWL_ERROR_CODES.blockedAddress });
    await expect(
      assertPublicHttpUrl('http://127.0.0.1', publicDnsResolver),
    ).rejects.toMatchObject({ code: CRAWL_ERROR_CODES.blockedAddress });
    await expect(
      assertPublicHttpUrl(
        'https://example.com',
        vi.fn(async () => ['127.0.0.1']),
      ),
    ).rejects.toMatchObject({ code: CRAWL_ERROR_CODES.blockedAddress });
  });
});

describe('crawler fetch behavior', () => {
  it('revalidates every redirect and allows same-host relative redirects', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, {
          headers: {
            location: '/next',
          },
          status: 302,
        }),
      )
      .mockResolvedValueOnce(
        new Response('<html><body>ok</body></html>', {
          headers: {
            'content-type': 'text/html; charset=utf-8',
          },
          status: 200,
        }),
      );

    const result = await fetchCrawlResource({
      accept: 'text/html',
      allowedHostname: 'example.com',
      dnsResolver: publicDnsResolver,
      fetchImpl,
      requestedUrl: 'https://example.com/start',
    });

    expect(result.error).toBeNull();
    expect(result.finalUrl).toBe('https://example.com/next');
    expect(result.redirectChain).toEqual([
      {
        location: 'https://example.com/next',
        statusCode: 302,
      },
    ]);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('rejects cross-host redirects and uses fixed safe timeout errors', async () => {
    const redirectResult = await fetchCrawlResource({
      accept: 'text/html',
      allowedHostname: 'example.com',
      dnsResolver: publicDnsResolver,
      fetchImpl: vi.fn().mockResolvedValue(
        new Response(null, {
          headers: {
            location: 'https://other.example.com/escape',
          },
          status: 302,
        }),
      ),
      requestedUrl: 'https://example.com/start',
    });

    expect(redirectResult.error).toMatchObject({
      code: CRAWL_ERROR_CODES.crossHostRedirect,
    });

    const timeoutResult = await fetchCrawlResource({
      accept: 'text/html',
      allowedHostname: 'example.com',
      dnsResolver: publicDnsResolver,
      fetchImpl: vi.fn(
        (
          _input: string | URL | Request,
          init?: RequestInit,
        ): Promise<Response> =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
      requestTimeoutMs: 10,
      requestedUrl: 'https://example.com/slow',
    });

    expect(timeoutResult.error).toEqual({
      code: CRAWL_ERROR_CODES.timeout,
      message: 'The request timed out.',
    });
  });

  it('uses fixed safe errors for oversized responses and DNS failures', async () => {
    const oversizedResult = await fetchCrawlResource({
      accept: 'text/html',
      allowedHostname: 'example.com',
      dnsResolver: publicDnsResolver,
      fetchImpl: vi.fn().mockResolvedValue(
        new Response('x'.repeat(128), {
          headers: {
            'content-type': 'text/html',
          },
          status: 200,
        }),
      ),
      maxResponseBytes: 32,
      requestedUrl: 'https://example.com/large',
    });

    expect(oversizedResult.error).toEqual({
      code: CRAWL_ERROR_CODES.responseTooLarge,
      message: 'The response exceeded the size limit.',
    });

    const dnsFailureResult = await fetchCrawlResource({
      accept: 'text/html',
      allowedHostname: 'example.com',
      dnsResolver: vi.fn(async () => {
        throw new Error('ENOTFOUND secret.internal');
      }),
      requestedUrl: 'https://example.com',
    });

    expect(dnsFailureResult.error).toEqual({
      code: CRAWL_ERROR_CODES.dnsFailure,
      message: 'The URL could not be resolved.',
    });
    expect(JSON.stringify(dnsFailureResult)).not.toContain('secret.internal');
  });
});

describe('crawler robots and sitemap parsing', () => {
  it('respects robots disallow rules and discovers sitemap declarations', () => {
    const robots = parseRobotsTxt({
      content: [
        'User-agent: *',
        'Disallow: /private',
        'Sitemap: https://example.com/sitemap.xml',
      ].join('\n'),
      fetchedAt: new Date('2026-07-18T00:00:00.000Z'),
      statusCode: 200,
    });

    expect(robots.isAllowed('https://example.com/public')).toBe(true);
    expect(robots.isAllowed('https://example.com/private/report')).toBe(false);
    expect(robots.sitemaps).toEqual(['https://example.com/sitemap.xml']);
  });

  it('does not crash on malformed robots content', () => {
    const robots = parseRobotsTxt({
      content: '::::\nnot robots at all',
      fetchedAt: new Date('2026-07-18T00:00:00.000Z'),
      statusCode: 200,
    });

    expect(robots.isAllowed('https://example.com/anything')).toBe(true);
    expect(robots.sitemaps).toEqual([]);
  });

  it('parses standard sitemaps, bounds sitemap indexes, and ignores off-host URLs', async () => {
    expect(
      parseSitemapXml({
        content: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '<url><loc>https://example.com/</loc></url>',
          '<url><loc>https://example.com/about</loc></url>',
          '</urlset>',
        ].join(''),
        currentDepth: 0,
        maxDepth: 2,
      }).pageUrls,
    ).toEqual(['https://example.com/', 'https://example.com/about']);

    expect(
      parseSitemapXml({
        content: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          '<sitemap><loc>https://example.com/nested.xml</loc></sitemap>',
          '</sitemapindex>',
        ].join(''),
        currentDepth: 2,
        maxDepth: 2,
      }).warning,
    ).toMatchObject({
      code: CRAWL_WARNING_CODES.sitemapMalformed,
    });

    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      if (url.endsWith('/sitemap.xml')) {
        return new Response(
          [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
            '<url><loc>https://example.com/</loc></url>',
            '<url><loc>https://example.com/about</loc></url>',
            '<url><loc>https://example.com/about#fragment</loc></url>',
            '<url><loc>https://other.example.com/off-host</loc></url>',
            '</urlset>',
          ].join(''),
          {
            headers: {
              'content-type': 'application/xml',
            },
            status: 200,
          },
        );
      }

      throw new Error(`Unexpected sitemap request: ${url}`);
    });

    const result = await discoverSitemapUrls({
      allowedHostname: 'example.com',
      dnsResolver: publicDnsResolver,
      fetchImpl,
      initialSitemapUrls: [
        'https://example.com/sitemap.xml',
        'https://example.com/sitemap.xml',
      ],
    });

    expect(result.sitemapCount).toBe(1);
    expect(result.pageUrls).toEqual([
      'https://example.com',
      'https://example.com/about',
    ]);
  });
});

describe('crawler HTML extraction', () => {
  it('captures required page fields, normalizes internal links, and warns on malformed canonicals', () => {
    const result = extractHtmlPage({
      baseUrl: 'https://example.com/articles/guide',
      html: `
        <html lang="en">
          <head>
            <title> Guide Title </title>
            <meta name="description" content=" Useful guide ">
            <meta name="robots" content="noindex,follow">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <meta property="og:title" content="OG Guide">
            <meta property="og:description" content="OG Description">
            <link rel="canonical" href="https://user:pass@example.com">
          </head>
          <body>
            <nav>Navigation words only</nav>
            <h1>Main heading</h1>
            <h2>Section one</h2>
            <a href="/about#team">About</a>
            <a href="https://example.com/about">About duplicate</a>
            <a href="https://other.example.com/external">External</a>
            <a href="mailto:ignored@example.com">Ignored</a>
            <img src="/hero.jpg" alt="">
            <img src="/decorative.jpg" alt="Decorative">
            <script type="application/ld+json">{}</script>
            <script>ignored()</script>
            <p>Visible content words live here.</p>
          </body>
        </html>
      `,
      scopeHostname: 'example.com',
      xRobotsTag: 'noarchive',
    });

    expect(result).toMatchObject({
      externalLinkCount: 1,
      firstH1: 'Main heading',
      h1Count: 1,
      h2Count: 1,
      hasViewportMeta: true,
      htmlLang: 'en',
      imageCount: 2,
      imagesMissingAltCount: 1,
      internalLinkCount: 1,
      isIndexable: false,
      metaDescription: 'Useful guide',
      metaDescriptionLength: 12,
      metaRobots: 'noindex,follow',
      openGraphDescription: 'OG Description',
      openGraphTitle: 'OG Guide',
      structuredDataCount: 0,
      title: 'Guide Title',
      titleLength: 11,
    });
    expect(result.visibleWordCount).toBeGreaterThan(3);
    expect(result.internalLinks).toEqual(['https://example.com/about']);
    expect(result.canonicalWarning).toMatchObject({
      code: CRAWL_WARNING_CODES.malformedCanonical,
    });
  });
});
