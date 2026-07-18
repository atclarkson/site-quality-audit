import { describe, expect, it } from 'vitest';
import {
  FINDING_THRESHOLDS,
  generateFindingsForAudit,
  getFindingDefinition,
  type AuditFindingInput,
  type FindingPageInput,
} from './index';

const createPage = (
  overrides: Partial<FindingPageInput> = {},
): FindingPageInput => ({
  canonicalUrl: 'https://example.com/page',
  canonicalWarningCode: null,
  contentType: 'text/html; charset=utf-8',
  fetchStatus: 'SUCCESS',
  finalUrl: 'https://example.com/page',
  firstH1: 'Example page',
  h1Count: 1,
  h2Count: 1,
  hasViewportMeta: true,
  htmlLang: 'en',
  id: overrides.id || 'page-1',
  imagesMissingAltCount: 0,
  internalLinkCount: 3,
  isIndexable: true,
  metaDescription:
    'A long enough description to avoid the short description heuristic.',
  metaDescriptionLength: 72,
  metaRobots: 'index,follow',
  normalizedUrl: 'https://example.com/page',
  openGraphDescription: 'Open Graph description',
  openGraphTitle: 'Open Graph title',
  redirectCount: 0,
  responseSizeBytes: 50_000,
  responseTimeMs: 350,
  statusCode: 200,
  structuredDataCount: 1,
  title: 'Example page title',
  titleLength: 24,
  visibleWordCount: 700,
  xRobotsTag: null,
  ...overrides,
});

const createAuditInput = (
  overrides: Partial<AuditFindingInput> = {},
): AuditFindingInput => ({
  crawlLimitReached: false,
  crawledUrlCount: 1,
  excludedUrlCount: 0,
  failedUrlCount: 0,
  pages: [createPage()],
  primaryUrl: 'https://example.com/page',
  queuedUrlCount: 1,
  robotsTxtExists: true,
  robotsTxtStatusCode: 200,
  robotsWarningCode: null,
  robotsWarningMessage: null,
  sitemapCount: 1,
  sitemapUrlCount: 1,
  sitemapWarningCode: null,
  sitemapWarningMessage: null,
  ...overrides,
});

const findingCodes = (input: AuditFindingInput) =>
  generateFindingsForAudit(input).findings.map((finding) => finding.code);

describe('generateFindingsForAudit', () => {
  it('does not fire page rules for a valid control fixture', () => {
    expect(findingCodes(createAuditInput())).toEqual([]);
  });

  it('detects duplicate titles only for indexable html pages and ignores null titles', () => {
    const input = createAuditInput({
      crawledUrlCount: 4,
      pages: [
        createPage({
          id: 'page-1',
          normalizedUrl: 'https://example.com/a',
          title: 'Shared title',
          titleLength: 12,
        }),
        createPage({
          id: 'page-2',
          normalizedUrl: 'https://example.com/b',
          title: 'Shared title',
          titleLength: 12,
        }),
        createPage({
          id: 'page-3',
          fetchStatus: 'NON_HTML',
          normalizedUrl: 'https://example.com/feed.xml',
          title: 'Shared title',
          titleLength: 12,
        }),
        createPage({
          id: 'page-4',
          normalizedUrl: 'https://example.com/c',
          title: null,
          titleLength: null,
        }),
      ],
      primaryUrl: 'https://example.com/a',
      queuedUrlCount: 4,
    });

    const result = generateFindingsForAudit(input);
    const duplicateTitles = result.findings.filter(
      (finding) => finding.code === 'DUPLICATE_TITLE',
    );

    expect(duplicateTitles).toHaveLength(2);
    expect(
      result.findings.some(
        (finding) => finding.code === 'DUPLICATE_TITLE_CLUSTER',
      ),
    ).toBe(true);
    expect(
      duplicateTitles.every((finding) =>
        ['page-1', 'page-2'].includes(finding.crawledPageId!),
      ),
    ).toBe(true);
  });

  it('respects thin-content thresholds at their boundaries', () => {
    expect(
      findingCodes(
        createAuditInput({
          pages: [
            createPage({
              visibleWordCount: FINDING_THRESHOLDS.veryLowWordCount - 1,
            }),
          ],
        }),
      ),
    ).toContain('VERY_LOW_WORD_COUNT');

    expect(
      findingCodes(
        createAuditInput({
          pages: [
            createPage({
              visibleWordCount: FINDING_THRESHOLDS.veryLowWordCount,
            }),
          ],
        }),
      ),
    ).toContain('LOW_WORD_COUNT');

    expect(
      findingCodes(
        createAuditInput({
          pages: [
            createPage({
              visibleWordCount: FINDING_THRESHOLDS.lowWordCount,
              h2Count: 0,
            }),
          ],
        }),
      ),
    ).not.toContain('LOW_WORD_COUNT');
  });

  it('handles noindex and canonical rules correctly', () => {
    const input = createAuditInput({
      crawledUrlCount: 2,
      pages: [
        createPage({
          id: 'source-page',
          canonicalUrl: 'https://example.com/target',
          isIndexable: false,
          metaRobots: 'index,noindex',
          normalizedUrl: 'https://example.com/source',
          xRobotsTag: 'follow,nofollow',
        }),
        createPage({
          id: 'target-page',
          canonicalUrl: 'https://example.com/target',
          isIndexable: false,
          normalizedUrl: 'https://example.com/target',
        }),
      ],
      primaryUrl: 'https://example.com/source',
      queuedUrlCount: 2,
    });

    const codes = findingCodes(input);

    expect(codes).toContain('NOINDEX_PAGE');
    expect(codes).toContain('ROBOTS_DIRECTIVES_CONFLICT');
    expect(codes).toContain('CANONICAL_TARGET_NOINDEX');
  });

  it('labels response-time findings as response-time heuristics rather than Core Web Vitals', () => {
    const codes = findingCodes(
      createAuditInput({
        pages: [createPage({ responseTimeMs: 2_600 })],
      }),
    );

    expect(codes).toContain('RESPONSE_TIME_VERY_SLOW');
    expect(
      getFindingDefinition('RESPONSE_TIME_VERY_SLOW').explanation,
    ).toContain('response time');
    expect(
      getFindingDefinition('RESPONSE_TIME_VERY_SLOW').explanation,
    ).toContain('not Core Web Vitals');
  });

  it('scores page priority deterministically, caps it at 100, and boosts the primary url', () => {
    const input = createAuditInput({
      crawledUrlCount: 2,
      pages: [
        createPage({
          id: 'primary-page',
          h1Count: 0,
          imagesMissingAltCount: 2,
          internalLinkCount: 0,
          normalizedUrl: 'https://example.com/primary',
          responseTimeMs: 2_600,
          title: null,
          titleLength: null,
          visibleWordCount: 80,
        }),
        createPage({
          id: 'secondary-page',
          h1Count: 0,
          imagesMissingAltCount: 2,
          internalLinkCount: 0,
          normalizedUrl: 'https://example.com/secondary',
          responseTimeMs: 2_600,
          title: null,
          titleLength: null,
          visibleWordCount: 80,
        }),
      ],
      primaryUrl: 'https://example.com/primary',
      queuedUrlCount: 2,
    });

    const first = generateFindingsForAudit(input);
    const second = generateFindingsForAudit(input);
    const [primaryPage, secondaryPage] = first.pageSummaries;

    expect(first.pageSummaries).toEqual(second.pageSummaries);
    expect(primaryPage.priorityScore).toBeGreaterThan(
      secondaryPage.priorityScore,
    );
    expect(primaryPage.priorityScore).toBe(100);
  });

  it('adds audit-level findings for missing robots and sitemaps', () => {
    const codes = findingCodes(
      createAuditInput({
        crawledUrlCount: 4,
        failedUrlCount: 2,
        pages: [
          createPage({ isIndexable: false, metaRobots: 'noindex' }),
          createPage({
            id: 'page-2',
            isIndexable: false,
            metaRobots: 'noindex',
            normalizedUrl: 'https://example.com/page-2',
          }),
          createPage({
            id: 'page-3',
            fetchStatus: 'FAILED',
            isIndexable: false,
            normalizedUrl: 'https://example.com/page-3',
            statusCode: null,
          }),
          createPage({
            id: 'page-4',
            fetchStatus: 'FAILED',
            isIndexable: false,
            normalizedUrl: 'https://example.com/page-4',
            statusCode: null,
          }),
        ],
        queuedUrlCount: 4,
        robotsTxtStatusCode: 404,
        sitemapCount: 0,
        sitemapUrlCount: 0,
      }),
    );

    expect(codes).toContain('ROBOTS_TXT_UNAVAILABLE');
    expect(codes).toContain('NO_SITEMAP_DISCOVERED');
    expect(codes).toContain('FAILED_PAGE_RATE_HIGH');
    expect(codes).toContain('NOINDEX_RATE_HIGH');
  });
});
