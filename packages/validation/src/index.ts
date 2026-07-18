import { z } from 'zod';
import { isIP } from 'node:net';

export const portSchema = z.coerce.number().int().min(1).max(65535);

const privateIpv4Ranges = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.168.0.0', 16],
] as const;

const ipv4ToInt = (value: string) =>
  value.split('.').reduce((result, part) => (result << 8) + Number(part), 0);

const isIpv4InCidr = (value: string, network: string, prefix: number) => {
  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipv4ToInt(value) & mask) === (ipv4ToInt(network) & mask);
};

const isPrivateIpv4 = (value: string) =>
  privateIpv4Ranges.some(([network, prefix]) =>
    isIpv4InCidr(value, network, prefix),
  );

const expandIpv6 = (value: string) => {
  const [head, tail = ''] = value.toLowerCase().split('::');
  const headParts = head ? head.split(':').filter(Boolean) : [];
  const tailParts = tail ? tail.split(':').filter(Boolean) : [];

  if (tailParts.at(-1)?.includes('.')) {
    const ipv4 = tailParts.pop();

    if (!ipv4) {
      return null;
    }

    const octets = ipv4.split('.').map(Number);
    tailParts.push(
      ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16),
    );
  }

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

const isPrivateIpv6 = (value: string) => {
  const expanded = expandIpv6(value);

  if (!expanded) {
    return false;
  }

  const first = Number.parseInt(expanded[0], 16);
  const second = Number.parseInt(expanded[1], 16);

  return (
    value === '::' ||
    value === '::1' ||
    (first & 0xfe00) === 0xfc00 ||
    (first & 0xffc0) === 0xfe80 ||
    (first === 0x2001 && second === 0x0db8)
  );
};

const normalizePathname = (value: string) => {
  let segments: string[];

  try {
    segments = value
      .split('/')
      .filter(Boolean)
      .map((segment) => encodeURIComponent(decodeURIComponent(segment)));
  } catch {
    throw new Error('Enter a valid URL');
  }

  return segments.length === 0 ? '/' : `/${segments.join('/')}`;
};

const isLocalHostname = (hostname: string) =>
  hostname === 'localhost' || hostname.endsWith('.localhost');

const assertSafePublicHostname = (hostname: string) => {
  const normalizedHostname =
    hostname.startsWith('[') && hostname.endsWith(']')
      ? hostname.slice(1, -1)
      : hostname;

  if (isLocalHostname(normalizedHostname)) {
    throw new Error('Localhost URLs are not allowed');
  }

  const ipVersion = isIP(normalizedHostname);

  if (ipVersion === 4 && isPrivateIpv4(normalizedHostname)) {
    throw new Error('Private-network URLs are not allowed');
  }

  if (ipVersion === 6 && isPrivateIpv6(normalizedHostname)) {
    throw new Error('Private-network URLs are not allowed');
  }
};

export type NormalizedSiteUrl = {
  canonicalUrl: string;
  normalizedUrl: string;
};

export const normalizeSiteUrl = (input: string): NormalizedSiteUrl => {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    throw new Error('URL is required');
  }

  let url: URL;

  try {
    url = new URL(trimmedInput);
  } catch {
    throw new Error('Enter a valid URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('URL must start with http:// or https://');
  }

  if (url.username || url.password) {
    throw new Error('URLs with embedded credentials are not allowed');
  }

  const hostname = url.hostname.toLowerCase();
  assertSafePublicHostname(hostname);

  const port =
    (url.protocol === 'http:' && url.port === '80') ||
    (url.protocol === 'https:' && url.port === '443')
      ? ''
      : url.port;
  const pathname = normalizePathname(url.pathname);
  const origin = `${url.protocol}//${hostname}${port ? `:${port}` : ''}`;
  const canonicalUrl = pathname === '/' ? origin : `${origin}${pathname}`;

  return {
    canonicalUrl,
    normalizedUrl: canonicalUrl,
  };
};
