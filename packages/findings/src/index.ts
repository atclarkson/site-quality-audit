export const FINDING_THRESHOLDS = {
  descriptionLong: 170,
  descriptionShort: 70,
  largeResponseBytes: 2 * 1024 * 1024,
  lowWordCount: 300,
  responseTimeSlowMs: 1_000,
  responseTimeVerySlowMs: 2_500,
  substantialContentWordCount: 600,
  titleLong: 65,
  titleShort: 20,
  veryLowWordCount: 100,
} as const;

export const PAGE_PRIORITY_BASE_SCORES = {
  CRITICAL: 100,
  HIGH: 70,
  INFO: 5,
  LOW: 15,
  MEDIUM: 40,
} as const;

export const FINDING_SEVERITIES = [
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
] as const;

export const FINDING_CATEGORIES = [
  'CONTENT',
  'CRAWL',
  'INDEXABILITY',
  'METADATA',
  'PERFORMANCE',
  'SOCIAL',
] as const;

export type FindingSeverity = (typeof FINDING_SEVERITIES)[number];
export type FindingCategory = (typeof FINDING_CATEGORIES)[number];
export type FindingScope = 'AUDIT' | 'PAGE';

export type FindingCode =
  | 'ALMOST_NO_INTERNAL_LINKS'
  | 'CANONICAL_MISMATCH'
  | 'CANONICAL_MISSING'
  | 'CANONICAL_OFF_HOST'
  | 'CANONICAL_TARGET_NOINDEX'
  | 'CRAWL_LIMIT_REACHED'
  | 'DUPLICATE_DESCRIPTION'
  | 'DUPLICATE_DESCRIPTION_CLUSTER'
  | 'DUPLICATE_TITLE'
  | 'DUPLICATE_TITLE_CLUSTER'
  | 'EMPTY_TITLE_AND_H1'
  | 'FETCH_FAILED'
  | 'FAILED_PAGE_RATE_HIGH'
  | 'H1_MISSING'
  | 'HTML_LANG_MISSING'
  | 'HTTP_4XX'
  | 'HTTP_5XX'
  | 'IMAGES_MISSING_ALT'
  | 'LOW_WORD_COUNT'
  | 'META_DESCRIPTION_MISSING'
  | 'META_DESCRIPTION_TOO_LONG'
  | 'META_DESCRIPTION_TOO_SHORT'
  | 'MULTIPLE_H1'
  | 'MISSING_VIEWPORT_META'
  | 'NO_H2_ON_SUBSTANTIAL_CONTENT'
  | 'NO_SITEMAP_DISCOVERED'
  | 'NO_STRUCTURED_DATA'
  | 'NOINDEX_PAGE'
  | 'NOINDEX_RATE_HIGH'
  | 'NON_HTML_RESPONSE'
  | 'OG_DESCRIPTION_MISSING'
  | 'OG_TITLE_MISSING'
  | 'REDIRECT_RESPONSE'
  | 'RESPONSE_BODY_LARGE'
  | 'RESPONSE_TIME_SLOW'
  | 'RESPONSE_TIME_VERY_SLOW'
  | 'ROBOTS_DIRECTIVES_CONFLICT'
  | 'ROBOTS_TXT_MALFORMED'
  | 'ROBOTS_TXT_UNAVAILABLE'
  | 'SITEMAP_MALFORMED'
  | 'SITEMAP_UNAVAILABLE'
  | 'TITLE_MISSING'
  | 'TITLE_TOO_LONG'
  | 'TITLE_TOO_SHORT'
  | 'VERY_LOW_WORD_COUNT';

export type FindingDefinition = {
  category: FindingCategory;
  code: FindingCode;
  explanation: string;
  recommendedAction: string;
  scope: FindingScope;
  severity: FindingSeverity;
  title: string;
};

export type FindingPageInput = {
  canonicalUrl: string | null;
  canonicalWarningCode: string | null;
  contentType: string | null;
  fetchStatus: 'SUCCESS' | 'NON_HTML' | 'FAILED' | 'EXCLUDED';
  finalUrl: string | null;
  firstH1: string | null;
  h1Count: number;
  h2Count: number;
  hasViewportMeta: boolean;
  htmlLang: string | null;
  id: string;
  imagesMissingAltCount: number;
  internalLinkCount: number;
  isIndexable: boolean;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  metaRobots: string | null;
  normalizedUrl: string;
  openGraphDescription: string | null;
  openGraphTitle: string | null;
  redirectCount: number;
  responseSizeBytes: number | null;
  responseTimeMs: number | null;
  statusCode: number | null;
  structuredDataCount: number;
  title: string | null;
  titleLength: number | null;
  visibleWordCount: number;
  xRobotsTag: string | null;
};

export type AuditFindingInput = {
  crawlLimitReached: boolean;
  crawledUrlCount: number;
  excludedUrlCount: number;
  failedUrlCount: number;
  pages: FindingPageInput[];
  primaryUrl: string;
  queuedUrlCount: number;
  robotsTxtExists: boolean | null;
  robotsTxtStatusCode: number | null;
  robotsWarningCode: string | null;
  robotsWarningMessage: string | null;
  sitemapCount: number;
  sitemapUrlCount: number;
  sitemapWarningCode: string | null;
  sitemapWarningMessage: string | null;
};

export type FindingEvidence = Record<
  string,
  boolean | number | string | string[]
>;

export type GeneratedFinding = FindingDefinition & {
  crawledPageId: string | null;
  evidenceJson: FindingEvidence | null;
  priorityScore: number;
};

export type GeneratedPageSummary = {
  crawledPageId: string;
  findingCount: number;
  highestSeverity: FindingSeverity;
  priorityScore: number;
};

export type GeneratedAuditSummary = {
  criticalFindingCount: number;
  highFindingCount: number;
  infoFindingCount: number;
  lowFindingCount: number;
  mediumFindingCount: number;
  pagesWithFindingsCount: number;
};

export type GeneratedAuditFindings = {
  findings: GeneratedFinding[];
  pageSummaries: GeneratedPageSummary[];
  summary: GeneratedAuditSummary;
};

const severityWeight = {
  CRITICAL: 5,
  HIGH: 4,
  INFO: 1,
  LOW: 2,
  MEDIUM: 3,
} satisfies Record<FindingSeverity, number>;

const definitions = {
  ALMOST_NO_INTERNAL_LINKS: {
    category: 'CONTENT',
    code: 'ALMOST_NO_INTERNAL_LINKS',
    explanation:
      'This page links to almost no internal content, which can make it harder for users and crawlers to navigate the site.',
    recommendedAction:
      'Add a small number of relevant internal links to nearby supporting or next-step pages.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Page has almost no internal links',
  },
  CANONICAL_MISMATCH: {
    category: 'INDEXABILITY',
    code: 'CANONICAL_MISMATCH',
    explanation:
      'The canonical URL does not match the fetched page URL, which can send mixed signals about which version should be indexed.',
    recommendedAction:
      'Confirm that the canonical should point elsewhere. If not, update it to the final page URL.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Canonical does not match final URL',
  },
  CANONICAL_MISSING: {
    category: 'INDEXABILITY',
    code: 'CANONICAL_MISSING',
    explanation:
      'This indexable HTML page has no canonical URL, so search engines have less help choosing the preferred version.',
    recommendedAction:
      'Add a self-referencing canonical unless there is a deliberate alternate canonical target.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Canonical missing',
  },
  CANONICAL_OFF_HOST: {
    category: 'INDEXABILITY',
    code: 'CANONICAL_OFF_HOST',
    explanation:
      'The canonical points to another host, which may tell search engines to prefer a different site.',
    recommendedAction:
      'Verify that the off-host canonical is intentional. If not, point it back to the preferred URL on this site.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Canonical points off-host',
  },
  CANONICAL_TARGET_NOINDEX: {
    category: 'INDEXABILITY',
    code: 'CANONICAL_TARGET_NOINDEX',
    explanation:
      'The canonical target exists in this audit but appears non-indexable, which creates a weak preferred target.',
    recommendedAction:
      'Either make the canonical target indexable or update the canonical to a stable indexable page.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Canonical target appears non-indexable',
  },
  CRAWL_LIMIT_REACHED: {
    category: 'CRAWL',
    code: 'CRAWL_LIMIT_REACHED',
    explanation:
      'The crawl reached its page cap, so this audit may not cover the full site.',
    recommendedAction:
      'Review crawl scope or raise the crawl limit for a follow-up audit if broader coverage is needed.',
    scope: 'AUDIT',
    severity: 'HIGH',
    title: 'Crawl limit reached',
  },
  DUPLICATE_DESCRIPTION: {
    category: 'METADATA',
    code: 'DUPLICATE_DESCRIPTION',
    explanation:
      'This page shares its meta description with other indexable HTML pages, which reduces how specific the snippet can be.',
    recommendedAction:
      'Rewrite the meta description to describe this page’s purpose and value more specifically.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Duplicate meta description',
  },
  DUPLICATE_DESCRIPTION_CLUSTER: {
    category: 'METADATA',
    code: 'DUPLICATE_DESCRIPTION_CLUSTER',
    explanation:
      'Multiple indexable HTML pages share the same meta description, which suggests templated or reused snippets.',
    recommendedAction:
      'Review the repeated description cluster and make each snippet page-specific where it matters.',
    scope: 'AUDIT',
    severity: 'LOW',
    title: 'Duplicate meta description cluster',
  },
  DUPLICATE_TITLE: {
    category: 'METADATA',
    code: 'DUPLICATE_TITLE',
    explanation:
      'This page shares its title with other indexable HTML pages, which can blur page intent and search snippets.',
    recommendedAction:
      'Make the title more specific to this page’s topic or intent.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Duplicate title',
  },
  DUPLICATE_TITLE_CLUSTER: {
    category: 'METADATA',
    code: 'DUPLICATE_TITLE_CLUSTER',
    explanation:
      'Multiple indexable HTML pages share the same title, which suggests duplicated targeting or template reuse.',
    recommendedAction:
      'Review the repeated title cluster and make each title distinguish the page clearly.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'Duplicate title cluster',
  },
  EMPTY_TITLE_AND_H1: {
    category: 'CONTENT',
    code: 'EMPTY_TITLE_AND_H1',
    explanation:
      'This page has neither a usable title nor a usable H1, leaving very little context about what the page is for.',
    recommendedAction:
      'Add a clear page title and a matching H1 that describe the page’s purpose.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Title and H1 are both missing',
  },
  FAILED_PAGE_RATE_HIGH: {
    category: 'CRAWL',
    code: 'FAILED_PAGE_RATE_HIGH',
    explanation:
      'A large share of crawled pages failed to fetch, which weakens audit coverage and points to broader crawlability issues.',
    recommendedAction:
      'Inspect the failed-page pattern first and resolve the shared cause before trusting the rest of the audit.',
    scope: 'AUDIT',
    severity: 'HIGH',
    title: 'Unusually high failed-page percentage',
  },
  FETCH_FAILED: {
    category: 'CRAWL',
    code: 'FETCH_FAILED',
    explanation:
      'The crawler could not fetch this page reliably, so the page needs basic availability or crawlability attention first.',
    recommendedAction:
      'Check server availability, DNS, access rules, and redirects for this URL.',
    scope: 'PAGE',
    severity: 'CRITICAL',
    title: 'Page fetch failed',
  },
  H1_MISSING: {
    category: 'CONTENT',
    code: 'H1_MISSING',
    explanation:
      'This page has no H1 heading, which removes a strong on-page signal about the main topic.',
    recommendedAction:
      'Add one clear H1 that matches the page’s primary topic.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'H1 missing',
  },
  HTML_LANG_MISSING: {
    category: 'METADATA',
    code: 'HTML_LANG_MISSING',
    explanation:
      'The HTML document does not declare a language, which reduces clarity for browsers, assistive tools, and search engines.',
    recommendedAction:
      'Add the correct language code to the root HTML element.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'HTML lang missing',
  },
  HTTP_4XX: {
    category: 'CRAWL',
    code: 'HTTP_4XX',
    explanation:
      'This page returned a 4xx status, so the URL is not serving the expected content.',
    recommendedAction:
      'Confirm whether the URL should exist. Fix broken links, routing, or redirects as appropriate.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Page returns 4xx',
  },
  HTTP_5XX: {
    category: 'CRAWL',
    code: 'HTTP_5XX',
    explanation:
      'This page returned a 5xx status, which points to a server-side failure rather than a content issue.',
    recommendedAction:
      'Fix the server-side error before making page-level content changes.',
    scope: 'PAGE',
    severity: 'CRITICAL',
    title: 'Page returns 5xx',
  },
  IMAGES_MISSING_ALT: {
    category: 'CONTENT',
    code: 'IMAGES_MISSING_ALT',
    explanation:
      'Some images are missing alt text, which weakens accessibility and image context.',
    recommendedAction:
      'Add concise alt text to informative images and keep decorative images intentionally empty.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Images missing alt text',
  },
  LOW_WORD_COUNT: {
    category: 'CONTENT',
    code: 'LOW_WORD_COUNT',
    explanation:
      'This page has relatively little visible text. That can be fine for utilities or landing pages, but it is worth checking whether the page provides enough context for its purpose.',
    recommendedAction:
      'Review whether the page needs more useful detail, examples, or supporting context for its intent.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Low visible word count',
  },
  META_DESCRIPTION_MISSING: {
    category: 'METADATA',
    code: 'META_DESCRIPTION_MISSING',
    explanation:
      'This page has no meta description, so search engines have less page-specific snippet guidance.',
    recommendedAction:
      'Add a concise description that reflects the page content and intent.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Meta description missing',
  },
  META_DESCRIPTION_TOO_LONG: {
    category: 'METADATA',
    code: 'META_DESCRIPTION_TOO_LONG',
    explanation:
      'This meta description is longer than the current heuristic target and may be truncated.',
    recommendedAction:
      'Shorten the description to keep the main message near the front.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Meta description may be too long',
  },
  META_DESCRIPTION_TOO_SHORT: {
    category: 'METADATA',
    code: 'META_DESCRIPTION_TOO_SHORT',
    explanation:
      'This meta description is shorter than the current heuristic target and may not describe the page clearly enough.',
    recommendedAction:
      'Expand the description so it summarizes the page more specifically.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Meta description may be too short',
  },
  MISSING_VIEWPORT_META: {
    category: 'METADATA',
    code: 'MISSING_VIEWPORT_META',
    explanation:
      'This page is missing a viewport meta tag, which can hurt basic mobile rendering behavior.',
    recommendedAction:
      'Add a standard viewport meta tag for responsive layout behavior.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Viewport meta missing',
  },
  MULTIPLE_H1: {
    category: 'CONTENT',
    code: 'MULTIPLE_H1',
    explanation:
      'This page has multiple H1 headings, which can dilute the main topic signal.',
    recommendedAction:
      'Keep one primary H1 and move additional headings down a level when possible.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Multiple H1 headings',
  },
  NO_H2_ON_SUBSTANTIAL_CONTENT: {
    category: 'CONTENT',
    code: 'NO_H2_ON_SUBSTANTIAL_CONTENT',
    explanation:
      'This page has substantial visible content but no H2 headings, which may make the page harder to scan.',
    recommendedAction:
      'Break longer content into clear sections with descriptive H2s where it improves readability.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'No H2 on substantial page',
  },
  NO_SITEMAP_DISCOVERED: {
    category: 'CRAWL',
    code: 'NO_SITEMAP_DISCOVERED',
    explanation:
      'The audit did not discover any sitemap, which can make site coverage less predictable.',
    recommendedAction:
      'Publish a sitemap and reference it consistently in robots.txt or site configuration.',
    scope: 'AUDIT',
    severity: 'LOW',
    title: 'No sitemap discovered',
  },
  NO_STRUCTURED_DATA: {
    category: 'SOCIAL',
    code: 'NO_STRUCTURED_DATA',
    explanation:
      'This page has no structured data blocks. That is not always a problem, but it may be a missed enhancement opportunity.',
    recommendedAction:
      'Add structured data where it matches the page type and can be maintained accurately.',
    scope: 'PAGE',
    severity: 'INFO',
    title: 'No structured data blocks',
  },
  NOINDEX_PAGE: {
    category: 'INDEXABILITY',
    code: 'NOINDEX_PAGE',
    explanation:
      'This page appears non-indexable because robots directives include noindex or an equivalent instruction.',
    recommendedAction:
      'Confirm that noindex is intentional. Remove it if the page should be discoverable in search.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Page marked noindex',
  },
  NOINDEX_RATE_HIGH: {
    category: 'INDEXABILITY',
    code: 'NOINDEX_RATE_HIGH',
    explanation:
      'A large share of crawled pages appear non-indexable, which may be intentional but deserves review.',
    recommendedAction:
      'Review whether the noindex pattern is deliberate or a wider template/configuration issue.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'Unusually high noindex percentage',
  },
  NON_HTML_RESPONSE: {
    category: 'CRAWL',
    code: 'NON_HTML_RESPONSE',
    explanation:
      'This URL did not return HTML, so it cannot be evaluated like a normal content page.',
    recommendedAction:
      'Confirm whether this URL belongs in the crawl scope or should be treated as a document/feed/asset instead.',
    scope: 'PAGE',
    severity: 'INFO',
    title: 'Non-HTML response',
  },
  OG_DESCRIPTION_MISSING: {
    category: 'SOCIAL',
    code: 'OG_DESCRIPTION_MISSING',
    explanation:
      'This page is missing an Open Graph description, so social previews may be less controlled.',
    recommendedAction:
      'Add an Open Graph description if social sharing quality matters for this page type.',
    scope: 'PAGE',
    severity: 'INFO',
    title: 'Open Graph description missing',
  },
  OG_TITLE_MISSING: {
    category: 'SOCIAL',
    code: 'OG_TITLE_MISSING',
    explanation:
      'This page is missing an Open Graph title, so social previews may be less controlled.',
    recommendedAction:
      'Add an Open Graph title if social sharing quality matters for this page type.',
    scope: 'PAGE',
    severity: 'INFO',
    title: 'Open Graph title missing',
  },
  REDIRECT_RESPONSE: {
    category: 'CRAWL',
    code: 'REDIRECT_RESPONSE',
    explanation:
      'This URL resolved through a redirect rather than serving the final page directly.',
    recommendedAction:
      'Review whether the redirect is intentional and whether internal links should point straight to the final URL.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'URL responds with redirect behavior',
  },
  RESPONSE_BODY_LARGE: {
    category: 'PERFORMANCE',
    code: 'RESPONSE_BODY_LARGE',
    explanation:
      'The response body is large, which can increase download time. This is a server-response size signal, not a Core Web Vitals score.',
    recommendedAction:
      'Review whether markup, payload, or embedded data can be reduced without removing needed content.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Large response body',
  },
  RESPONSE_TIME_SLOW: {
    category: 'PERFORMANCE',
    code: 'RESPONSE_TIME_SLOW',
    explanation:
      'The server response time exceeded the slower heuristic threshold. This is a response-time signal, not Core Web Vitals.',
    recommendedAction:
      'Inspect server timing, cache behavior, or upstream dependencies for this URL.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Slow server response time',
  },
  RESPONSE_TIME_VERY_SLOW: {
    category: 'PERFORMANCE',
    code: 'RESPONSE_TIME_VERY_SLOW',
    explanation:
      'The server response time exceeded the very slow heuristic threshold. This is a response-time signal, not Core Web Vitals.',
    recommendedAction:
      'Treat server latency on this URL as a triage item before deeper page optimizations.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Very slow server response time',
  },
  ROBOTS_DIRECTIVES_CONFLICT: {
    category: 'INDEXABILITY',
    code: 'ROBOTS_DIRECTIVES_CONFLICT',
    explanation:
      'Robots directives appear conflicting or malformed, which makes the intended indexability less clear.',
    recommendedAction:
      'Align robots meta and X-Robots-Tag directives so they express one clear intent.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Conflicting or malformed robots directives',
  },
  ROBOTS_TXT_MALFORMED: {
    category: 'CRAWL',
    code: 'ROBOTS_TXT_MALFORMED',
    explanation:
      'robots.txt was fetched but produced a malformed warning during parsing.',
    recommendedAction:
      'Review the robots.txt syntax and simplify or fix the malformed directives.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'robots.txt malformed',
  },
  ROBOTS_TXT_UNAVAILABLE: {
    category: 'CRAWL',
    code: 'ROBOTS_TXT_UNAVAILABLE',
    explanation:
      'robots.txt was unavailable during the audit, so crawler guidance and sitemap discovery were weaker than expected.',
    recommendedAction:
      'Make robots.txt reachable and verify it returns the intended content.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'robots.txt unavailable',
  },
  SITEMAP_MALFORMED: {
    category: 'CRAWL',
    code: 'SITEMAP_MALFORMED',
    explanation:
      'A discovered sitemap produced a malformed warning, which may reduce crawl coverage.',
    recommendedAction:
      'Review sitemap generation and fix malformed or unsupported sitemap output.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'Sitemap malformed',
  },
  SITEMAP_UNAVAILABLE: {
    category: 'CRAWL',
    code: 'SITEMAP_UNAVAILABLE',
    explanation:
      'A sitemap could not be fetched during the audit, which may reduce coverage or freshness.',
    recommendedAction:
      'Verify the sitemap URL and make sure it responds reliably.',
    scope: 'AUDIT',
    severity: 'MEDIUM',
    title: 'Sitemap unavailable',
  },
  TITLE_MISSING: {
    category: 'METADATA',
    code: 'TITLE_MISSING',
    explanation:
      'This page has no title, so one of the strongest page-level context signals is missing.',
    recommendedAction:
      'Add a descriptive title that distinguishes this page clearly.',
    scope: 'PAGE',
    severity: 'HIGH',
    title: 'Title missing',
  },
  TITLE_TOO_LONG: {
    category: 'METADATA',
    code: 'TITLE_TOO_LONG',
    explanation:
      'This title is longer than the current heuristic target and may be truncated in results.',
    recommendedAction:
      'Tighten the title so the main topic appears earlier and more clearly.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Title may be too long',
  },
  TITLE_TOO_SHORT: {
    category: 'METADATA',
    code: 'TITLE_TOO_SHORT',
    explanation:
      'This title is shorter than the current heuristic target and may not describe the page specifically enough.',
    recommendedAction:
      'Expand the title so it better distinguishes the page and its intent.',
    scope: 'PAGE',
    severity: 'LOW',
    title: 'Title may be too short',
  },
  VERY_LOW_WORD_COUNT: {
    category: 'CONTENT',
    code: 'VERY_LOW_WORD_COUNT',
    explanation:
      'This page has very little visible text. Some page types can be concise, but this threshold is low enough to warrant a quick review.',
    recommendedAction:
      'Confirm that the page has enough useful content for its purpose or strengthen it where needed.',
    scope: 'PAGE',
    severity: 'MEDIUM',
    title: 'Very low visible word count',
  },
} satisfies Record<FindingCode, FindingDefinition>;

const isHtmlLikePage = (page: FindingPageInput) =>
  page.fetchStatus === 'SUCCESS' &&
  Boolean(page.contentType?.includes('text/html') || !page.contentType);

const isIndexableHtmlPage = (page: FindingPageInput) =>
  isHtmlLikePage(page) && page.isIndexable;

const normalizeComparableText = (value: string) =>
  value.replace(/\s+/g, ' ').trim().toLowerCase();

const normalizeDirectiveTokens = (value: string | null) =>
  value
    ?.split(/[,\s]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean) || [];

const hasDirectiveConflict = (tokens: string[]) =>
  (tokens.includes('index') && tokens.includes('noindex')) ||
  (tokens.includes('follow') && tokens.includes('nofollow'));

const getHostname = (value: string) => {
  try {
    return new URL(value).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const severityCompare = (left: FindingSeverity, right: FindingSeverity) =>
  severityWeight[right] - severityWeight[left];

const addPageFinding = (
  findings: GeneratedFinding[],
  code: FindingCode,
  page: FindingPageInput,
  evidenceJson: FindingEvidence | null = null,
) => {
  findings.push({
    ...definitions[code],
    crawledPageId: page.id,
    evidenceJson,
    priorityScore: 0,
  });
};

const addAuditFinding = (
  findings: GeneratedFinding[],
  code: FindingCode,
  evidenceJson: FindingEvidence | null = null,
) => {
  findings.push({
    ...definitions[code],
    crawledPageId: null,
    evidenceJson,
    priorityScore: 0,
  });
};

const buildDuplicateClusters = (
  pages: FindingPageInput[],
  field: 'metaDescription' | 'title',
) => {
  const clusters = new Map<string, FindingPageInput[]>();

  for (const page of pages) {
    if (!isIndexableHtmlPage(page)) {
      continue;
    }

    const value = page[field];

    if (!value) {
      continue;
    }

    const key = normalizeComparableText(value);

    if (!key) {
      continue;
    }

    const cluster = clusters.get(key) || [];
    cluster.push(page);
    clusters.set(key, cluster);
  }

  return Array.from(clusters.entries()).filter(
    ([, cluster]) => cluster.length > 1,
  );
};

const buildPagePriority = (
  page: FindingPageInput,
  pageFindings: GeneratedFinding[],
  primaryUrl: string,
  duplicateClusterSizes: Map<string, number>,
) => {
  const highestSeverity = [...pageFindings].sort((left, right) =>
    severityCompare(left.severity, right.severity),
  )[0]?.severity;

  if (!highestSeverity) {
    return 0;
  }

  let score = PAGE_PRIORITY_BASE_SCORES[highestSeverity];

  if (page.normalizedUrl === primaryUrl) {
    score += 20;
  }

  if (isIndexableHtmlPage(page)) {
    score += 10;
  }

  if (
    pageFindings.some(
      (finding) =>
        finding.code === 'FETCH_FAILED' || finding.code === 'HTTP_5XX',
    )
  ) {
    score += 20;
  }

  if (pageFindings.some((finding) => finding.code === 'NOINDEX_PAGE')) {
    score += 15;
  }

  score += Math.min(15, Math.max(0, pageFindings.length - 1) * 5);

  const duplicateBoost = Math.max(duplicateClusterSizes.get(page.id) || 0, 0);

  if (duplicateBoost > 2) {
    score += Math.min(10, (duplicateBoost - 2) * 2);
  }

  return Math.min(100, score);
};

const summarizeFindings = (findings: GeneratedFinding[]) => ({
  criticalFindingCount: findings.filter(
    (finding) => finding.severity === 'CRITICAL',
  ).length,
  highFindingCount: findings.filter((finding) => finding.severity === 'HIGH')
    .length,
  infoFindingCount: findings.filter((finding) => finding.severity === 'INFO')
    .length,
  lowFindingCount: findings.filter((finding) => finding.severity === 'LOW')
    .length,
  mediumFindingCount: findings.filter(
    (finding) => finding.severity === 'MEDIUM',
  ).length,
  pagesWithFindingsCount: new Set(
    findings
      .filter((finding) => finding.crawledPageId)
      .map((finding) => finding.crawledPageId),
  ).size,
});

export const getFindingDefinition = (code: FindingCode) => definitions[code];
export const findingDefinitions = Object.values(definitions);

export const generateFindingsForAudit = (
  input: AuditFindingInput,
): GeneratedAuditFindings => {
  const primaryHostname = getHostname(input.primaryUrl);
  const pages = [...input.pages].sort((left, right) =>
    left.normalizedUrl.localeCompare(right.normalizedUrl),
  );
  const findings: GeneratedFinding[] = [];
  const pagesByNormalizedUrl = new Map(
    pages.map((page) => [page.normalizedUrl, page] as const),
  );

  const titleClusters = buildDuplicateClusters(pages, 'title');
  const descriptionClusters = buildDuplicateClusters(pages, 'metaDescription');
  const duplicateClusterSizes = new Map<string, number>();

  for (const [, cluster] of [...titleClusters, ...descriptionClusters]) {
    for (const page of cluster) {
      duplicateClusterSizes.set(
        page.id,
        Math.max(duplicateClusterSizes.get(page.id) || 0, cluster.length),
      );
    }
  }

  for (const page of pages) {
    if (page.fetchStatus === 'FAILED') {
      addPageFinding(findings, 'FETCH_FAILED', page, {
        statusCode: page.statusCode || 'none',
      });
    }

    if (page.statusCode !== null && page.statusCode >= 500) {
      addPageFinding(findings, 'HTTP_5XX', page, {
        statusCode: page.statusCode,
      });
    }

    if (
      page.statusCode !== null &&
      page.statusCode >= 400 &&
      page.statusCode < 500
    ) {
      addPageFinding(findings, 'HTTP_4XX', page, {
        statusCode: page.statusCode,
      });
    }

    if (
      page.redirectCount > 0 ||
      ((page.statusCode ?? 0) >= 300 && (page.statusCode ?? 0) < 400)
    ) {
      addPageFinding(findings, 'REDIRECT_RESPONSE', page, {
        redirectCount: page.redirectCount,
        statusCode: page.statusCode || 'none',
      });
    }

    if (page.fetchStatus === 'NON_HTML') {
      addPageFinding(findings, 'NON_HTML_RESPONSE', page, {
        contentType: page.contentType || 'unknown',
      });
    }

    const robotsTokens = [
      ...normalizeDirectiveTokens(page.metaRobots),
      ...normalizeDirectiveTokens(page.xRobotsTag),
    ];

    if (page.fetchStatus === 'SUCCESS' && !page.isIndexable) {
      addPageFinding(findings, 'NOINDEX_PAGE', page, {
        directives: robotsTokens,
      });
    }

    if (page.fetchStatus === 'SUCCESS' && hasDirectiveConflict(robotsTokens)) {
      addPageFinding(findings, 'ROBOTS_DIRECTIVES_CONFLICT', page, {
        directives: robotsTokens,
      });
    }

    if (isIndexableHtmlPage(page) && !page.canonicalUrl) {
      addPageFinding(findings, 'CANONICAL_MISSING', page);
    }

    if (
      page.canonicalUrl &&
      primaryHostname &&
      getHostname(page.canonicalUrl) &&
      getHostname(page.canonicalUrl) !== primaryHostname
    ) {
      addPageFinding(findings, 'CANONICAL_OFF_HOST', page, {
        canonicalUrl: page.canonicalUrl,
      });
    }

    if (
      page.canonicalUrl &&
      page.finalUrl &&
      getHostname(page.canonicalUrl) === primaryHostname &&
      page.canonicalUrl !== page.finalUrl
    ) {
      addPageFinding(findings, 'CANONICAL_MISMATCH', page, {
        canonicalUrl: page.canonicalUrl,
        finalUrl: page.finalUrl,
      });
    }

    if (page.canonicalUrl) {
      const canonicalTarget = pagesByNormalizedUrl.get(page.canonicalUrl);

      if (canonicalTarget && !canonicalTarget.isIndexable) {
        addPageFinding(findings, 'CANONICAL_TARGET_NOINDEX', page, {
          canonicalUrl: page.canonicalUrl,
          canonicalTargetUrl: canonicalTarget.normalizedUrl,
        });
      }
    }

    if (isHtmlLikePage(page) && !page.title) {
      addPageFinding(findings, 'TITLE_MISSING', page);
    }

    if (
      isHtmlLikePage(page) &&
      page.titleLength !== null &&
      page.titleLength < FINDING_THRESHOLDS.titleShort
    ) {
      addPageFinding(findings, 'TITLE_TOO_SHORT', page, {
        titleLength: page.titleLength,
      });
    }

    if (
      isHtmlLikePage(page) &&
      page.titleLength !== null &&
      page.titleLength > FINDING_THRESHOLDS.titleLong
    ) {
      addPageFinding(findings, 'TITLE_TOO_LONG', page, {
        titleLength: page.titleLength,
      });
    }

    if (!page.metaDescription && isHtmlLikePage(page)) {
      addPageFinding(findings, 'META_DESCRIPTION_MISSING', page);
    }

    if (
      isHtmlLikePage(page) &&
      page.metaDescriptionLength !== null &&
      page.metaDescriptionLength < FINDING_THRESHOLDS.descriptionShort
    ) {
      addPageFinding(findings, 'META_DESCRIPTION_TOO_SHORT', page, {
        metaDescriptionLength: page.metaDescriptionLength,
      });
    }

    if (
      isHtmlLikePage(page) &&
      page.metaDescriptionLength !== null &&
      page.metaDescriptionLength > FINDING_THRESHOLDS.descriptionLong
    ) {
      addPageFinding(findings, 'META_DESCRIPTION_TOO_LONG', page, {
        metaDescriptionLength: page.metaDescriptionLength,
      });
    }

    if (isHtmlLikePage(page) && page.h1Count === 0) {
      addPageFinding(findings, 'H1_MISSING', page);
    }

    if (isHtmlLikePage(page) && page.h1Count > 1) {
      addPageFinding(findings, 'MULTIPLE_H1', page, { h1Count: page.h1Count });
    }

    if (
      isHtmlLikePage(page) &&
      page.visibleWordCount < FINDING_THRESHOLDS.veryLowWordCount
    ) {
      addPageFinding(findings, 'VERY_LOW_WORD_COUNT', page, {
        visibleWordCount: page.visibleWordCount,
      });
    } else if (
      isHtmlLikePage(page) &&
      page.visibleWordCount < FINDING_THRESHOLDS.lowWordCount
    ) {
      addPageFinding(findings, 'LOW_WORD_COUNT', page, {
        visibleWordCount: page.visibleWordCount,
      });
    }

    if (
      isHtmlLikePage(page) &&
      page.visibleWordCount >= FINDING_THRESHOLDS.substantialContentWordCount &&
      page.h2Count === 0
    ) {
      addPageFinding(findings, 'NO_H2_ON_SUBSTANTIAL_CONTENT', page, {
        visibleWordCount: page.visibleWordCount,
      });
    }

    if (isHtmlLikePage(page) && !page.title && !page.firstH1) {
      addPageFinding(findings, 'EMPTY_TITLE_AND_H1', page);
    }

    if (isHtmlLikePage(page) && page.internalLinkCount < 1) {
      addPageFinding(findings, 'ALMOST_NO_INTERNAL_LINKS', page, {
        internalLinkCount: page.internalLinkCount,
      });
    }

    if (isHtmlLikePage(page) && page.imagesMissingAltCount > 0) {
      addPageFinding(findings, 'IMAGES_MISSING_ALT', page, {
        imagesMissingAltCount: page.imagesMissingAltCount,
      });
    }

    if (isHtmlLikePage(page) && !page.hasViewportMeta) {
      addPageFinding(findings, 'MISSING_VIEWPORT_META', page);
    }

    if (isHtmlLikePage(page) && !page.htmlLang) {
      addPageFinding(findings, 'HTML_LANG_MISSING', page);
    }

    if (isHtmlLikePage(page) && !page.openGraphTitle) {
      addPageFinding(findings, 'OG_TITLE_MISSING', page);
    }

    if (isHtmlLikePage(page) && !page.openGraphDescription) {
      addPageFinding(findings, 'OG_DESCRIPTION_MISSING', page);
    }

    if (isHtmlLikePage(page) && page.structuredDataCount === 0) {
      addPageFinding(findings, 'NO_STRUCTURED_DATA', page);
    }

    if (
      page.responseTimeMs !== null &&
      page.responseTimeMs > FINDING_THRESHOLDS.responseTimeVerySlowMs
    ) {
      addPageFinding(findings, 'RESPONSE_TIME_VERY_SLOW', page, {
        responseTimeMs: page.responseTimeMs,
      });
    } else if (
      page.responseTimeMs !== null &&
      page.responseTimeMs > FINDING_THRESHOLDS.responseTimeSlowMs
    ) {
      addPageFinding(findings, 'RESPONSE_TIME_SLOW', page, {
        responseTimeMs: page.responseTimeMs,
      });
    }

    if (
      page.responseSizeBytes !== null &&
      page.responseSizeBytes > FINDING_THRESHOLDS.largeResponseBytes
    ) {
      addPageFinding(findings, 'RESPONSE_BODY_LARGE', page, {
        responseSizeBytes: page.responseSizeBytes,
      });
    }
  }

  for (const [duplicateTitle, cluster] of titleClusters) {
    for (const page of cluster) {
      addPageFinding(findings, 'DUPLICATE_TITLE', page, {
        affectedPageCount: cluster.length,
        duplicateValue: duplicateTitle,
      });
    }

    addAuditFinding(findings, 'DUPLICATE_TITLE_CLUSTER', {
      affectedPageCount: cluster.length,
      sampleUrl: cluster[0]?.normalizedUrl || 'unknown',
    });
  }

  for (const [duplicateDescription, cluster] of descriptionClusters) {
    for (const page of cluster) {
      addPageFinding(findings, 'DUPLICATE_DESCRIPTION', page, {
        affectedPageCount: cluster.length,
        duplicateValue: duplicateDescription,
      });
    }

    addAuditFinding(findings, 'DUPLICATE_DESCRIPTION_CLUSTER', {
      affectedPageCount: cluster.length,
      sampleUrl: cluster[0]?.normalizedUrl || 'unknown',
    });
  }

  if (input.robotsTxtStatusCode === null || input.robotsTxtStatusCode >= 400) {
    addAuditFinding(findings, 'ROBOTS_TXT_UNAVAILABLE', {
      robotsTxtStatusCode: input.robotsTxtStatusCode || 'none',
    });
  }

  if (input.robotsWarningCode) {
    addAuditFinding(findings, 'ROBOTS_TXT_MALFORMED', {
      robotsWarningCode: input.robotsWarningCode,
      robotsWarningMessage: input.robotsWarningMessage || 'robots warning',
    });
  }

  if (input.sitemapCount === 0 && input.sitemapUrlCount === 0) {
    addAuditFinding(findings, 'NO_SITEMAP_DISCOVERED');
  }

  if (input.sitemapWarningCode === 'SITEMAP_UNAVAILABLE') {
    addAuditFinding(findings, 'SITEMAP_UNAVAILABLE', {
      sitemapWarningMessage:
        input.sitemapWarningMessage || 'sitemap unavailable',
    });
  }

  if (input.sitemapWarningCode === 'SITEMAP_MALFORMED') {
    addAuditFinding(findings, 'SITEMAP_MALFORMED', {
      sitemapWarningMessage: input.sitemapWarningMessage || 'sitemap malformed',
    });
  }

  if (input.crawlLimitReached) {
    addAuditFinding(findings, 'CRAWL_LIMIT_REACHED', {
      queuedUrlCount: input.queuedUrlCount,
    });
  }

  const crawledAndFailed = input.crawledUrlCount + input.failedUrlCount;
  const failedRate =
    crawledAndFailed > 0 ? input.failedUrlCount / crawledAndFailed : 0;

  if (failedRate >= 0.25) {
    addAuditFinding(findings, 'FAILED_PAGE_RATE_HIGH', {
      failedPagePercentage: Math.round(failedRate * 100),
    });
  }

  const indexablePages = pages.filter(isHtmlLikePage);
  const noindexPages = indexablePages.filter((page) => !page.isIndexable);
  const noindexRate =
    indexablePages.length > 0 ? noindexPages.length / indexablePages.length : 0;

  if (noindexRate >= 0.3) {
    addAuditFinding(findings, 'NOINDEX_RATE_HIGH', {
      noindexPagePercentage: Math.round(noindexRate * 100),
    });
  }

  const findingsByPage = new Map<string, GeneratedFinding[]>();

  for (const finding of findings) {
    if (!finding.crawledPageId) {
      continue;
    }

    const pageFindings = findingsByPage.get(finding.crawledPageId) || [];
    pageFindings.push(finding);
    findingsByPage.set(finding.crawledPageId, pageFindings);
  }

  const pageSummaries: GeneratedPageSummary[] = [];

  for (const page of pages) {
    const pageFindings = findingsByPage.get(page.id);

    if (!pageFindings || pageFindings.length === 0) {
      continue;
    }

    const priorityScore = buildPagePriority(
      page,
      pageFindings,
      input.primaryUrl,
      duplicateClusterSizes,
    );
    const highestSeverity = [...pageFindings].sort((left, right) =>
      severityCompare(left.severity, right.severity),
    )[0]!.severity;

    for (const finding of pageFindings) {
      finding.priorityScore = priorityScore;
    }

    pageSummaries.push({
      crawledPageId: page.id,
      findingCount: pageFindings.length,
      highestSeverity,
      priorityScore,
    });
  }

  for (const finding of findings) {
    if (finding.crawledPageId) {
      continue;
    }

    let score = PAGE_PRIORITY_BASE_SCORES[finding.severity];
    const affectedCount = Number(finding.evidenceJson?.affectedPageCount || 0);

    if (finding.code === 'CRAWL_LIMIT_REACHED') {
      score += 10;
    }

    if (
      finding.code === 'DUPLICATE_TITLE_CLUSTER' ||
      finding.code === 'DUPLICATE_DESCRIPTION_CLUSTER'
    ) {
      score += Math.min(10, Math.max(0, affectedCount - 2) * 2);
    }

    finding.priorityScore = Math.min(100, score);
  }

  findings.sort((left, right) => {
    if (left.crawledPageId && right.crawledPageId) {
      const leftUrl =
        pages.find((page) => page.id === left.crawledPageId)?.normalizedUrl ||
        '';
      const rightUrl =
        pages.find((page) => page.id === right.crawledPageId)?.normalizedUrl ||
        '';

      return (
        leftUrl.localeCompare(rightUrl) || left.code.localeCompare(right.code)
      );
    }

    if (left.crawledPageId) {
      return -1;
    }

    if (right.crawledPageId) {
      return 1;
    }

    return left.code.localeCompare(right.code);
  });

  pageSummaries.sort((left, right) => {
    if (right.priorityScore !== left.priorityScore) {
      return right.priorityScore - left.priorityScore;
    }

    if (right.highestSeverity !== left.highestSeverity) {
      return severityCompare(left.highestSeverity, right.highestSeverity);
    }

    const leftUrl =
      pages.find((page) => page.id === left.crawledPageId)?.normalizedUrl || '';
    const rightUrl =
      pages.find((page) => page.id === right.crawledPageId)?.normalizedUrl ||
      '';

    return leftUrl.localeCompare(rightUrl);
  });

  return {
    findings,
    pageSummaries,
    summary: summarizeFindings(findings),
  };
};
