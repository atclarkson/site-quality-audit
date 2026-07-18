import { gunzipSync } from 'node:zlib';
import { isIP } from 'node:net';
import { load } from 'cheerio';
import { XMLParser } from 'fast-xml-parser';

export const CRAWLER_USER_AGENT = 'SiteQualityAuditBot/0.1';

export const DEFAULT_CRAWL_LIMITS = {
  concurrency: 3,
  maxPages: 100,
  maxRedirects: 5,
  maxResponseBytes: 5 * 1024 * 1024,
  maxSitemapDepth: 2,
  maxSitemapDocuments: 10,
  maxSitemapUrls: 500,
  maxDepth: 5,
  perHostDelayMs: 200,
  requestTimeoutMs: 15_000,
} as const;

export type CrawlLimits = {
  [Key in keyof typeof DEFAULT_CRAWL_LIMITS]: number;
};

export const CRAWL_ERROR_CODES = {
  blockedAddress: 'BLOCKED_ADDRESS',
  connectionFailed: 'CONNECTION_FAILED',
  crossHostRedirect: 'CROSS_HOST_REDIRECT',
  dnsFailure: 'DNS_FAILURE',
  invalidUrl: 'INVALID_URL',
  redirectLoop: 'REDIRECT_LOOP',
  robotsDisallowed: 'ROBOTS_DISALLOWED',
  responseTooLarge: 'RESPONSE_TOO_LARGE',
  timeout: 'REQUEST_TIMEOUT',
  tooManyRedirects: 'TOO_MANY_REDIRECTS',
} as const;

export const CRAWL_ERROR_MESSAGES = {
  [CRAWL_ERROR_CODES.blockedAddress]: 'The URL resolved to a blocked address.',
  [CRAWL_ERROR_CODES.connectionFailed]: 'The URL could not be reached.',
  [CRAWL_ERROR_CODES.crossHostRedirect]: 'The URL redirected outside the site.',
  [CRAWL_ERROR_CODES.dnsFailure]: 'The URL could not be resolved.',
  [CRAWL_ERROR_CODES.invalidUrl]: 'The URL is not crawlable.',
  [CRAWL_ERROR_CODES.redirectLoop]: 'The URL redirected in a loop.',
  [CRAWL_ERROR_CODES.robotsDisallowed]: 'The URL was excluded by robots.txt.',
  [CRAWL_ERROR_CODES.responseTooLarge]: 'The response exceeded the size limit.',
  [CRAWL_ERROR_CODES.timeout]: 'The request timed out.',
  [CRAWL_ERROR_CODES.tooManyRedirects]: 'The URL redirected too many times.',
} as const;

export const CRAWL_WARNING_CODES = {
  malformedCanonical: 'MALFORMED_CANONICAL',
  sitemapUnavailable: 'SITEMAP_UNAVAILABLE',
  sitemapMalformed: 'SITEMAP_MALFORMED',
} as const;

export type CrawlErrorCode =
  (typeof CRAWL_ERROR_CODES)[keyof typeof CRAWL_ERROR_CODES];
export type CrawlWarningCode =
  (typeof CRAWL_WARNING_CODES)[keyof typeof CRAWL_WARNING_CODES];

export type CrawlError = {
  code: CrawlErrorCode;
  message: string;
};

export type CrawlWarning = {
  code: CrawlWarningCode;
  message: string;
};

export type DnsResolver = (hostname: string) => Promise<string[]>;
export type FetchImpl = typeof fetch;

export type NormalizedCrawlUrl = {
  hostname: string;
  normalizedUrl: string;
  url: URL;
};

export type RedirectHop = {
  location: string;
  statusCode: number;
};

export type SelectedResponseHeaders = {
  cacheControl: string | null;
  contentLength: string | null;
  contentType: string | null;
  location: string | null;
  xRobotsTag: string | null;
};

export type CrawlFetchResult =
  | {
      bodyText: string;
      error: null;
      fetchedAt: Date;
      finalUrl: string;
      headers: SelectedResponseHeaders;
      redirectChain: RedirectHop[];
      responseSizeBytes: number;
      responseTimeMs: number;
      statusCode: number;
    }
  | {
      bodyText: null;
      error: CrawlError;
      fetchedAt: Date;
      finalUrl: string | null;
      headers: SelectedResponseHeaders | null;
      redirectChain: RedirectHop[];
      responseSizeBytes: null;
      responseTimeMs: number;
      statusCode: number | null;
    };

export type RobotsRuleSet = {
  exists: boolean;
  fetchedAt: Date | null;
  sitemaps: string[];
  statusCode: number | null;
  warnings: CrawlWarning[];
};

export type ParsedRobotsTxt = RobotsRuleSet & {
  isAllowed: (url: string) => boolean;
};

export type SitemapDiscoveryResult = {
  pageUrls: string[];
  sitemapCount: number;
  warnings: CrawlWarning[];
};

export type HtmlExtractionResult = {
  canonicalUrl: string | null;
  canonicalWarning: CrawlWarning | null;
  externalLinks: string[];
  externalLinkCount: number;
  firstH1: string | null;
  h1Count: number;
  h2Count: number;
  hasViewportMeta: boolean;
  htmlLang: string | null;
  imageCount: number;
  imagesMissingAltCount: number;
  internalLinks: string[];
  internalLinkCount: number;
  isIndexable: boolean;
  metaDescription: string | null;
  metaDescriptionLength: number | null;
  metaRobots: string | null;
  openGraphDescription: string | null;
  openGraphTitle: string | null;
  structuredDataCount: number;
  title: string | null;
  titleLength: number | null;
  visibleWordCount: number;
};

const privateIpv4Cidrs = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const;

const localSchemes = new Set([
  'blob:',
  'data:',
  'file:',
  'ftp:',
  'javascript:',
  'mailto:',
  'tel:',
]);

const textDecoder = new TextDecoder();
const xmlParser = new XMLParser({
  attributeNamePrefix: '',
  ignoreAttributes: false,
  removeNSPrefix: true,
});

const ipv4ToInt = (value: string) =>
  value.split('.').reduce((result, part) => (result << 8) + Number(part), 0);

const isIpv4InCidr = (value: string, network: string, prefix: number) => {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(value) & mask) === (ipv4ToInt(network) & mask);
};

const isUnsafeIpv4 = (value: string) =>
  privateIpv4Cidrs.some(([network, prefix]) =>
    isIpv4InCidr(value, network, prefix),
  );

const expandIpv6 = (value: string) => {
  const [head, tail = ''] = value.toLowerCase().split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];
  const missingGroups = 8 - (headParts.length + tailParts.length);

  if (missingGroups < 0) {
    return null;
  }

  return [
    ...headParts,
    ...Array.from({ length: missingGroups }, () => '0'),
    ...tailParts,
  ].map((part) => part.padStart(4, '0'));
};

const isUnsafeIpv6 = (value: string) => {
  const expanded = expandIpv6(value);

  if (!expanded) {
    return true;
  }

  const first = Number.parseInt(expanded[0], 16);
  const second = Number.parseInt(expanded[1], 16);

  return (
    value === '::' ||
    value === '::1' ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first & 0xff00) === 0xff00 ||
    (first === 0x2001 && second === 0x0db8)
  );
};

const normalizePathname = (pathname: string) => {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((segment) => encodeURIComponent(decodeURIComponent(segment)));
  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

const normalizeSearch = (searchParams: URLSearchParams) => {
  const pairs = Array.from(searchParams.entries()).sort(
    ([leftKey], [rightKey]) => leftKey.localeCompare(rightKey),
  );
  if (pairs.length === 0) {
    return '';
  }
  return `?${new URLSearchParams(pairs).toString()}`;
};

const selectHeaders = (headers: Headers): SelectedResponseHeaders => ({
  cacheControl: headers.get('cache-control'),
  contentLength: headers.get('content-length'),
  contentType: headers.get('content-type'),
  location: headers.get('location'),
  xRobotsTag: headers.get('x-robots-tag'),
});

const trimText = (value: string | undefined | null) => {
  const trimmed = value?.replace(/\s+/g, ' ').trim() || '';
  return trimmed.length === 0 ? null : trimmed;
};

const toReaderBytes = async (
  response: Response,
  maxResponseBytes: number,
): Promise<Uint8Array> => {
  if (!response.body) {
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    total += value.byteLength;

    if (total > maxResponseBytes) {
      throw new Error(CRAWL_ERROR_CODES.responseTooLarge);
    }

    chunks.push(value);
  }

  const buffer = new Uint8Array(total);
  let offset = 0;

  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return buffer;
};

const decodeResponseBody = (bytes: Uint8Array, response: Response) => {
  const contentEncoding = response.headers
    .get('content-encoding')
    ?.toLowerCase();
  const contentType = response.headers.get('content-type')?.toLowerCase() || '';
  const isGzipFile =
    contentType.includes('application/gzip') ||
    response.url.toLowerCase().endsWith('.gz');
  const normalizedBytes =
    contentEncoding === 'gzip' || isGzipFile ? gunzipSync(bytes) : bytes;
  return textDecoder.decode(normalizedBytes);
};

const buildFetchError = (code: CrawlErrorCode): CrawlError => ({
  code,
  message: CRAWL_ERROR_MESSAGES[code],
});

const toFetchErrorCode = (error: unknown): CrawlErrorCode => {
  if (
    error instanceof Error &&
    error.message === CRAWL_ERROR_CODES.responseTooLarge
  ) {
    return CRAWL_ERROR_CODES.responseTooLarge;
  }

  if (error instanceof DOMException && error.name === 'AbortError') {
    return CRAWL_ERROR_CODES.timeout;
  }

  if (error instanceof Error && /ENOTFOUND|EAI_AGAIN/i.test(error.message)) {
    return CRAWL_ERROR_CODES.dnsFailure;
  }

  return CRAWL_ERROR_CODES.connectionFailed;
};

export const normalizeCrawlUrl = (
  input: string,
  baseUrl?: string,
): NormalizedCrawlUrl => {
  let url: URL;

  try {
    url = baseUrl ? new URL(input, baseUrl) : new URL(input);
  } catch {
    throw new Error(CRAWL_ERROR_CODES.invalidUrl);
  }

  if (
    localSchemes.has(url.protocol) ||
    !['http:', 'https:'].includes(url.protocol)
  ) {
    throw new Error(CRAWL_ERROR_CODES.invalidUrl);
  }

  if (url.username || url.password) {
    throw new Error(CRAWL_ERROR_CODES.invalidUrl);
  }

  url.hash = '';
  url.hostname = url.hostname.toLowerCase();

  if (
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
  ) {
    url.port = '';
  }

  url.pathname = normalizePathname(url.pathname);
  url.search = normalizeSearch(url.searchParams);

  const normalizedUrl =
    url.pathname === '/'
      ? `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.search}`
      : `${url.protocol}//${url.hostname}${url.port ? `:${url.port}` : ''}${url.pathname}${url.search}`;

  return {
    hostname: url.hostname,
    normalizedUrl,
    url: new URL(normalizedUrl),
  };
};

export const isSameNormalizedHostname = (leftUrl: string, rightUrl: string) =>
  normalizeCrawlUrl(leftUrl).hostname === normalizeCrawlUrl(rightUrl).hostname;

export const assertPublicHttpUrl = async (
  candidateUrl: string,
  dnsResolver: DnsResolver,
) => {
  const normalized = normalizeCrawlUrl(candidateUrl);

  if (
    normalized.hostname === 'localhost' ||
    normalized.hostname.endsWith('.localhost')
  ) {
    throw buildFetchError(CRAWL_ERROR_CODES.blockedAddress);
  }

  const ipVersion = isIP(normalized.hostname);

  if (ipVersion === 4 && isUnsafeIpv4(normalized.hostname)) {
    throw buildFetchError(CRAWL_ERROR_CODES.blockedAddress);
  }

  if (ipVersion === 6 && isUnsafeIpv6(normalized.hostname)) {
    throw buildFetchError(CRAWL_ERROR_CODES.blockedAddress);
  }

  if (ipVersion === 0) {
    let resolvedAddresses: string[];

    try {
      resolvedAddresses = await dnsResolver(normalized.hostname);
    } catch {
      throw buildFetchError(CRAWL_ERROR_CODES.dnsFailure);
    }

    if (resolvedAddresses.length === 0) {
      throw buildFetchError(CRAWL_ERROR_CODES.dnsFailure);
    }

    if (
      resolvedAddresses.some((address) => {
        const version = isIP(address);
        return (
          (version === 4 && isUnsafeIpv4(address)) ||
          (version === 6 && isUnsafeIpv6(address))
        );
      })
    ) {
      throw buildFetchError(CRAWL_ERROR_CODES.blockedAddress);
    }
  }

  return normalized;
};

export const fetchCrawlResource = async ({
  accept,
  allowedHostname,
  dnsResolver,
  fetchImpl = fetch,
  maxRedirects = DEFAULT_CRAWL_LIMITS.maxRedirects,
  maxResponseBytes = DEFAULT_CRAWL_LIMITS.maxResponseBytes,
  requestTimeoutMs = DEFAULT_CRAWL_LIMITS.requestTimeoutMs,
  requestedUrl,
  userAgent = CRAWLER_USER_AGENT,
}: {
  accept: string;
  allowedHostname: string;
  dnsResolver: DnsResolver;
  fetchImpl?: FetchImpl;
  maxRedirects?: number;
  maxResponseBytes?: number;
  requestTimeoutMs?: number;
  requestedUrl: string;
  userAgent?: string;
}): Promise<CrawlFetchResult> => {
  const redirectChain: RedirectHop[] = [];
  const seenUrls = new Set<string>();
  let currentUrl = requestedUrl;
  const startedAt = Date.now();

  for (
    let redirectCount = 0;
    redirectCount <= maxRedirects;
    redirectCount += 1
  ) {
    let normalizedCurrent: NormalizedCrawlUrl;

    try {
      normalizedCurrent = await assertPublicHttpUrl(currentUrl, dnsResolver);
    } catch (error) {
      const crawlError =
        error && typeof error === 'object' && 'code' in error
          ? (error as CrawlError)
          : buildFetchError(CRAWL_ERROR_CODES.invalidUrl);
      return {
        bodyText: null,
        error: crawlError,
        fetchedAt: new Date(),
        finalUrl: null,
        headers: null,
        redirectChain,
        responseSizeBytes: null,
        responseTimeMs: Date.now() - startedAt,
        statusCode: null,
      };
    }

    if (normalizedCurrent.hostname !== allowedHostname) {
      return {
        bodyText: null,
        error: buildFetchError(CRAWL_ERROR_CODES.crossHostRedirect),
        fetchedAt: new Date(),
        finalUrl: normalizedCurrent.normalizedUrl,
        headers: null,
        redirectChain,
        responseSizeBytes: null,
        responseTimeMs: Date.now() - startedAt,
        statusCode: null,
      };
    }

    if (seenUrls.has(normalizedCurrent.normalizedUrl)) {
      return {
        bodyText: null,
        error: buildFetchError(CRAWL_ERROR_CODES.redirectLoop),
        fetchedAt: new Date(),
        finalUrl: normalizedCurrent.normalizedUrl,
        headers: null,
        redirectChain,
        responseSizeBytes: null,
        responseTimeMs: Date.now() - startedAt,
        statusCode: null,
      };
    }

    seenUrls.add(normalizedCurrent.normalizedUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetchImpl(normalizedCurrent.normalizedUrl, {
        headers: {
          Accept: accept,
          'User-Agent': userAgent,
        },
        redirect: 'manual',
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const headers = selectHeaders(response.headers);
      const fetchedAt = new Date();

      if (response.status >= 300 && response.status < 400 && headers.location) {
        const redirectTarget = normalizeCrawlUrl(
          headers.location,
          normalizedCurrent.normalizedUrl,
        ).normalizedUrl;

        redirectChain.push({
          location: redirectTarget,
          statusCode: response.status,
        });

        currentUrl = redirectTarget;
        continue;
      }

      const bytes = await toReaderBytes(response, maxResponseBytes);

      return {
        bodyText: decodeResponseBody(bytes, response),
        error: null,
        fetchedAt,
        finalUrl: normalizeCrawlUrl(
          response.url || normalizedCurrent.normalizedUrl,
        ).normalizedUrl,
        headers,
        redirectChain,
        responseSizeBytes: bytes.byteLength,
        responseTimeMs: Date.now() - startedAt,
        statusCode: response.status,
      };
    } catch (error) {
      clearTimeout(timeout);
      return {
        bodyText: null,
        error: buildFetchError(toFetchErrorCode(error)),
        fetchedAt: new Date(),
        finalUrl: normalizedCurrent.normalizedUrl,
        headers: null,
        redirectChain,
        responseSizeBytes: null,
        responseTimeMs: Date.now() - startedAt,
        statusCode: null,
      };
    }
  }

  return {
    bodyText: null,
    error: buildFetchError(CRAWL_ERROR_CODES.tooManyRedirects),
    fetchedAt: new Date(),
    finalUrl: currentUrl,
    headers: null,
    redirectChain,
    responseSizeBytes: null,
    responseTimeMs: Date.now() - startedAt,
    statusCode: null,
  };
};

type RobotsGroup = {
  allowRules: string[];
  disallowRules: string[];
  userAgents: string[];
};

const parseRobotsGroups = (content: string) => {
  const groups: RobotsGroup[] = [];
  let currentGroup: RobotsGroup | null = null;
  const sitemaps = new Set<string>();

  for (const line of content.split(/\r?\n/)) {
    const normalizedLine = line.split('#')[0]?.trim();

    if (!normalizedLine) {
      currentGroup = null;
      continue;
    }

    const [rawField, ...rawValue] = normalizedLine.split(':');

    if (!rawField || rawValue.length === 0) {
      continue;
    }

    const field = rawField.trim().toLowerCase();
    const value = rawValue.join(':').trim();

    if (field === 'sitemap') {
      if (value) {
        sitemaps.add(value);
      }
      continue;
    }

    if (field === 'user-agent') {
      currentGroup = currentGroup ?? {
        allowRules: [],
        disallowRules: [],
        userAgents: [],
      };
      currentGroup.userAgents.push(value.toLowerCase());
      if (!groups.includes(currentGroup)) {
        groups.push(currentGroup);
      }
      continue;
    }

    if (!currentGroup) {
      continue;
    }

    if (field === 'allow') {
      currentGroup.allowRules.push(value);
    }

    if (field === 'disallow') {
      currentGroup.disallowRules.push(value);
    }
  }

  return {
    groups,
    sitemaps: Array.from(sitemaps),
  };
};

const selectRobotsGroup = (groups: RobotsGroup[], userAgent: string) => {
  const normalizedUserAgent = userAgent.toLowerCase();
  return (
    groups.find((group) =>
      group.userAgents.some((agent) => agent === normalizedUserAgent),
    ) ||
    groups.find((group) => group.userAgents.includes('*')) || {
      allowRules: [],
      disallowRules: [],
      userAgents: [],
    }
  );
};

const isRobotsPathAllowed = (
  pathnameWithSearch: string,
  group: RobotsGroup,
) => {
  const matchingAllow = group.allowRules
    .filter((rule) => rule && pathnameWithSearch.startsWith(rule))
    .sort((left, right) => right.length - left.length)[0];
  const matchingDisallow = group.disallowRules
    .filter((rule) => rule && pathnameWithSearch.startsWith(rule))
    .sort((left, right) => right.length - left.length)[0];

  if (!matchingDisallow) {
    return true;
  }

  return (matchingAllow?.length || 0) >= matchingDisallow.length;
};

export const parseRobotsTxt = ({
  content,
  fetchedAt,
  statusCode,
  userAgent = CRAWLER_USER_AGENT,
}: {
  content: string | null;
  fetchedAt: Date | null;
  statusCode: number | null;
  userAgent?: string;
}): ParsedRobotsTxt => {
  if (!content) {
    return {
      exists: statusCode !== null && statusCode < 400,
      fetchedAt,
      isAllowed: () => true,
      sitemaps: [],
      statusCode,
      warnings: [],
    };
  }

  try {
    const { groups, sitemaps } = parseRobotsGroups(content);
    const selectedGroup = selectRobotsGroup(groups, userAgent);

    return {
      exists: true,
      fetchedAt,
      isAllowed: (url) => {
        const normalized = normalizeCrawlUrl(url);
        return isRobotsPathAllowed(
          `${normalized.url.pathname}${normalized.url.search}`,
          selectedGroup,
        );
      },
      sitemaps,
      statusCode,
      warnings: [],
    };
  } catch {
    return {
      exists: true,
      fetchedAt,
      isAllowed: () => true,
      sitemaps: [],
      statusCode,
      warnings: [
        {
          code: CRAWL_WARNING_CODES.sitemapMalformed,
          message: 'robots.txt could not be parsed.',
        },
      ],
    };
  }
};

const toArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

export const parseSitemapXml = ({
  content,
  currentDepth,
  maxDepth,
}: {
  content: string;
  currentDepth: number;
  maxDepth: number;
}) => {
  const parsed = xmlParser.parse(content) as Record<string, unknown>;

  if ('urlset' in parsed) {
    const urls = toArray(
      (parsed.urlset as { url?: Array<{ loc?: string }> | { loc?: string } })
        .url,
    )
      .map((item) => item.loc)
      .filter((value): value is string => typeof value === 'string');

    return {
      childSitemaps: [] as string[],
      pageUrls: urls,
      warning: null,
    };
  }

  if ('sitemapindex' in parsed) {
    if (currentDepth >= maxDepth) {
      return {
        childSitemaps: [] as string[],
        pageUrls: [] as string[],
        warning: {
          code: CRAWL_WARNING_CODES.sitemapMalformed,
          message: 'Sitemap index depth limit reached.',
        } satisfies CrawlWarning,
      };
    }

    const sitemaps = toArray(
      (
        parsed.sitemapindex as {
          sitemap?: Array<{ loc?: string }> | { loc?: string };
        }
      ).sitemap,
    )
      .map((item) => item.loc)
      .filter((value): value is string => typeof value === 'string');

    return {
      childSitemaps: sitemaps,
      pageUrls: [] as string[],
      warning: null,
    };
  }

  return {
    childSitemaps: [] as string[],
    pageUrls: [] as string[],
    warning: {
      code: CRAWL_WARNING_CODES.sitemapMalformed,
      message: 'Sitemap XML was not recognized.',
    } satisfies CrawlWarning,
  };
};

export const discoverSitemapUrls = async ({
  allowedHostname,
  dnsResolver,
  fetchImpl = fetch,
  initialSitemapUrls,
  maxDepth = DEFAULT_CRAWL_LIMITS.maxSitemapDepth,
  maxDocuments = DEFAULT_CRAWL_LIMITS.maxSitemapDocuments,
  maxUrls = DEFAULT_CRAWL_LIMITS.maxSitemapUrls,
}: {
  allowedHostname: string;
  dnsResolver: DnsResolver;
  fetchImpl?: FetchImpl;
  initialSitemapUrls: string[];
  maxDepth?: number;
  maxDocuments?: number;
  maxUrls?: number;
}): Promise<SitemapDiscoveryResult> => {
  const queue = initialSitemapUrls.map((url) => ({ depth: 0, url }));
  const seenSitemaps = new Set<string>();
  const pageUrls = new Set<string>();
  const warnings: CrawlWarning[] = [];

  while (queue.length > 0 && seenSitemaps.size < maxDocuments) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    let normalizedSitemapUrl: NormalizedCrawlUrl;

    try {
      normalizedSitemapUrl = normalizeCrawlUrl(current.url);
    } catch {
      warnings.push({
        code: CRAWL_WARNING_CODES.sitemapUnavailable,
        message: 'A sitemap URL was invalid and skipped.',
      });
      continue;
    }

    if (normalizedSitemapUrl.hostname !== allowedHostname) {
      continue;
    }

    if (seenSitemaps.has(normalizedSitemapUrl.normalizedUrl)) {
      continue;
    }

    seenSitemaps.add(normalizedSitemapUrl.normalizedUrl);

    const response = await fetchCrawlResource({
      accept: 'application/xml,text/xml;q=0.9,*/*;q=0.1',
      allowedHostname,
      dnsResolver,
      fetchImpl,
      requestedUrl: normalizedSitemapUrl.normalizedUrl,
    });

    if (response.error || !response.bodyText) {
      warnings.push({
        code: CRAWL_WARNING_CODES.sitemapUnavailable,
        message: 'A sitemap could not be fetched.',
      });
      continue;
    }

    const parsed = parseSitemapXml({
      content: response.bodyText,
      currentDepth: current.depth,
      maxDepth,
    });

    if (parsed.warning) {
      warnings.push(parsed.warning);
    }

    for (const url of parsed.pageUrls) {
      if (pageUrls.size >= maxUrls) {
        break;
      }

      try {
        const normalizedPageUrl = normalizeCrawlUrl(url);

        if (normalizedPageUrl.hostname === allowedHostname) {
          pageUrls.add(normalizedPageUrl.normalizedUrl);
        }
      } catch {
        continue;
      }
    }

    for (const sitemapUrl of parsed.childSitemaps) {
      if (queue.length + seenSitemaps.size >= maxDocuments) {
        break;
      }

      queue.push({
        depth: current.depth + 1,
        url: sitemapUrl,
      });
    }
  }

  return {
    pageUrls: Array.from(pageUrls),
    sitemapCount: seenSitemaps.size,
    warnings,
  };
};

export const extractHtmlPage = ({
  baseUrl,
  html,
  scopeHostname,
  xRobotsTag,
}: {
  baseUrl: string;
  html: string;
  scopeHostname: string;
  xRobotsTag: string | null;
}): HtmlExtractionResult => {
  const $ = load(html);

  $('script,style,noscript,template,svg,nav,header,footer').remove();

  const title = trimText($('title').first().text());
  const metaDescription = trimText(
    $('meta[name="description"]').attr('content') || null,
  );
  const metaRobots = trimText($('meta[name="robots"]').attr('content') || null);
  const htmlLang = trimText($('html').attr('lang') || null);
  const firstH1 = trimText($('h1').first().text());
  const openGraphTitle = trimText(
    $('meta[property="og:title"]').attr('content') || null,
  );
  const openGraphDescription = trimText(
    $('meta[property="og:description"]').attr('content') || null,
  );
  const viewportContent = trimText(
    $('meta[name="viewport"]').attr('content') || null,
  );

  let canonicalUrl: string | null = null;
  let canonicalWarning: CrawlWarning | null = null;
  const canonicalValue = $('link[rel="canonical"]').first().attr('href');

  if (canonicalValue) {
    try {
      canonicalUrl = normalizeCrawlUrl(canonicalValue, baseUrl).normalizedUrl;
    } catch {
      canonicalWarning = {
        code: CRAWL_WARNING_CODES.malformedCanonical,
        message: 'Canonical URL could not be normalized.',
      };
    }
  }

  const internalLinks = new Set<string>();
  const externalLinks = new Set<string>();

  $('a[href]').each((_, element) => {
    const href = $(element).attr('href');

    if (!href) {
      return;
    }

    try {
      const normalized = normalizeCrawlUrl(href, baseUrl);

      if (normalized.hostname === scopeHostname) {
        internalLinks.add(normalized.normalizedUrl);
      } else {
        externalLinks.add(normalized.normalizedUrl);
      }
    } catch {
      return;
    }
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const visibleWordCount = bodyText ? bodyText.split(/\s+/).length : 0;
  const robotDirectives =
    `${metaRobots || ''} ${xRobotsTag || ''}`.toLowerCase();

  return {
    canonicalUrl,
    canonicalWarning,
    externalLinks: Array.from(externalLinks),
    externalLinkCount: externalLinks.size,
    firstH1,
    h1Count: $('h1').length,
    h2Count: $('h2').length,
    hasViewportMeta: viewportContent !== null,
    htmlLang,
    imageCount: $('img').length,
    imagesMissingAltCount: $('img').filter((_, image) => {
      const alt = $(image).attr('alt');
      return alt === undefined || alt.trim().length === 0;
    }).length,
    internalLinks: Array.from(internalLinks),
    internalLinkCount: internalLinks.size,
    isIndexable: !/\bnoindex\b|\bnone\b/.test(robotDirectives),
    metaDescription,
    metaDescriptionLength: metaDescription?.length || null,
    metaRobots,
    openGraphDescription,
    openGraphTitle,
    structuredDataCount: $('script[type="application/ld+json"]').length,
    title,
    titleLength: title?.length || null,
    visibleWordCount,
  };
};
